class DropController {
  constructor($scope, $q, $injector, $modal,
              AccountsRepository, DocumentsRepository, MovementsRepository, FileHasher, RulesContainer) {
    this.$scope = $scope;
    this.$q = $q;
    this.$injector = $injector;
    this.$modal = $modal;
    this.accounts = AccountsRepository;
    this.documents = DocumentsRepository;
    this.movements = MovementsRepository;
    this.FileHasher = FileHasher;
    this.RulesContainer = RulesContainer;

    this.replaceableMovements = _.filter(this.movements.all, function(movement) {
      return !!movement.replaceHandler;
    });
    var ctrl = this;
    $scope.$watch('ctrl.movements.all', function(movements) {
      ctrl.replaceableMovements = _.filter(movements, function(movement) {
        return !!movement.replaceHandler;
      });
    });
  }

  importFiles(account, files) {
    var ctrl = this;
    //console.log('Importing files for ', account.name);
    _.each(files, function(file) {
      if ('iwbank' === account.bank) {
        if (file.type == 'application/pdf') {
          ctrl.importFile(account, file, 'IWBankEstrattoContoReader');
        } else {
          ctrl.importFile(account, file, 'IWBankListaMovimentiReader');
        }
      } else if ('bnl' === account.bank) {
        if (file.type == 'application/pdf') {
          // TODO: add pdf import for BNL
        } else {
          ctrl.importFile(account, file, 'BNLListaMovimentiReader');
        }
      } else if ('iwpower' === account.bank) {
        if (file.type == 'application/pdf') {
          // IWPower does not provide PDF reports
        } else {
          ctrl.importFile(account, file, 'IWPowerListaMovimentiReader');
        }
      } else if ('intesa' === account.bank) {
        if (file.type === 'application/pdf') {
          ctrl.importFile(account, file, 'IntesaEstrattoContoReader');
        } else {
          // TODO: add xls import for Intesa
        }
      }
    });
  }

  importFile(account, file, readerName) {
    var ctrl = this;
    this.readFile(file, readerName).then(function(document) {
      _.each(document.movements, function(movement) {
        movement.account = account;
      });

      ctrl.appendMovements(document);
    });
  }

  appendMovements(document) {
    this.applyAllRules(document.movements);

    var modal = this.$modal.open({
      templateUrl: 'components/import_modal.html',
      controller: 'ImportModalController as ctrl',
      size: 'lg',
      windowClass: ['import-modal'],
      resolve: {
        document: function() {
          return document;
        }
      }
    });

    var ctrl = this;
    return modal.result.then(function(movementsToImport) {
      // save document and then movements in it
      return ctrl.documents.add(document).then(function(savedDocument) {
        movementsToImport.forEach(function(movement) {
          movement.document = savedDocument;
        });
        return ctrl.movements.add(movementsToImport);
      });
    });
  }

  applyAllRules(movements) {
    var RulesContainer = this.RulesContainer;
    _.each(movements, function(movement) {
      RulesContainer.applyAll(movement);
    });
  }

  readFile(file, readerName) {
    var $q = this.$q;
    var reader = this.$injector.get(readerName);
    var documents = this.documents;
    return this.FileHasher.hashFile(file).then(function(file) {
      var existingDocument = documents.findByHash(file.hash);
      if (!existingDocument) {
        return file;
      }
      return $q(function(resolve, reject) {
        swal({
          title: 'File già importato',
          html: 'Sembra che tu abbia già importato <strong>' + file.name + '</strong>, eseguire di nuovo l\'importazione potrebbe creare movimenti duplicati.\n'
          + 'Come vuoi procedere?',
          type: "info",
          allowOutsideClick: true,
          showCancelButton: true,
          confirmButtonColor: '#DD6B55',
          confirmButtonText: 'Importa ugualmente',
          cancelButtonText: 'Annulla'
        }, function (isConfirm) {
          if (isConfirm) {
            resolve(file);
          } else {
            reject(new Error('Canceled by user'));
          }
        });
      });
    }).then(function() {
      return reader.read(file);
    });
  }

  replaceMovement(movement, file) {
    var ctrl = this;
    this.readFile(file, movement.replaceHandler.readerName).then(function(document) {
      if (_.isFunction(movement.replaceHandler.check)) {
        try {
          movement.replaceHandler.check(movement, document);
        } catch (e) {
          sweetAlert('Oops..', e.message);
          return;
        }
      }

      _.each(document.movements, function(mov) {
        mov.account = movement.account;
      });

      ctrl.appendMovements(document).then(function() {
        // on append successful remove the original movement from the list
        ctrl.movements.remove(movement);
      });
    });
  }
}

export default DropController;