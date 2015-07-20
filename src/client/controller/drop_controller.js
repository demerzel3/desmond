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

    this.replaceableMovements = this.movements.all.filter((movement) => {
      return !!movement.replaceHandler;
    });
    $scope.$watch('ctrl.movements.all', (movements) => {
      this.replaceableMovements = movements.filter((movement) => {
        return !!movement.replaceHandler;
      });
    });
  }

  importFiles(account, files) {
    for (var file of files) {
      if ('iwbank' === account.bank) {
        if (file.type == 'application/pdf') {
          this.importFile(account, file, 'IWBankEstrattoContoReader');
        } else {
          this.importFile(account, file, 'IWBankListaMovimentiReader');
        }
      } else if ('bnl' === account.bank) {
        if (file.type == 'application/pdf') {
          // TODO: add pdf import for BNL
        } else {
          this.importFile(account, file, 'BNLListaMovimentiReader');
        }
      } else if ('iwpower' === account.bank) {
        if (file.type == 'application/pdf') {
          // IWPower does not provide PDF reports
        } else {
          this.importFile(account, file, 'IWPowerListaMovimentiReader');
        }
      } else if ('intesa' === account.bank) {
        if (file.type === 'application/pdf') {
          this.importFile(account, file, 'IntesaEstrattoContoReader');
        } else {
          // TODO: add xls import for Intesa
        }
      } else if ('widiba' === account.bank) {
        if (file.type === 'application/pdf') {
          // TODO: add pdf import for Widiba
        } else {
          this.importFile(account, file, 'WidibaListaMovimentiReader');
        }
      }
    }
  }

  importFile(account, file, readerName) {
    this.readFile(file, readerName).then((document) => {
      for (var movement of document.movements) {
        movement.account = account;
      }

      this.appendMovements(document);
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
        document: () => document
      }
    });

    return modal.result.then((movementsToImport) => {
      // save document and then movements in it
      return this.documents.add(document).then((savedDocument) => {
        for (var movement of movementsToImport) {
          movement.document = savedDocument;
        }
        return this.movements.add(movementsToImport);
      });
    });
  }

  applyAllRules(movements) {
    var RulesContainer = this.RulesContainer;
    for (var movement of movements) {
      RulesContainer.applyAll(movement);
    }
  }

  readFile(file, readerName) {
    var $q = this.$q;
    var reader = this.$injector.get(readerName);
    var documents = this.documents;
    return this.FileHasher.hashFile(file).then((file) => {
      var existingDocument = documents.findByHash(file.hash);
      if (!existingDocument) {
        return file;
      }
      return $q((resolve, reject) => {
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
        }, (isConfirm) => {
          if (isConfirm) {
            resolve(file);
          } else {
            reject(new Error('Canceled by user'));
          }
        });
      });
    }).then(() => {
      return reader.read(file);
    });
  }

  replaceMovement(movement, file) {
    this.readFile(file, movement.replaceHandler.readerName).then((document) => {
      if (_.isFunction(movement.replaceHandler.check)) {
        try {
          movement.replaceHandler.check(movement, document);
        } catch (e) {
          sweetAlert('Oops..', e.message);
          return;
        }
      }

      for (var mov of document.movements) {
        mov.account = movement.account;
      }

      this.appendMovements(document).then(() => {
        // on append successful remove the original movement from the list
        this.movements.remove(movement);
      });
    });
  }
}
DropController.$inject = ['$scope', '$q', '$injector', '$modal',
    'AccountsRepository', 'DocumentsRepository', 'MovementsRepository', 'FileHasher', 'RulesContainer'];

export default DropController;