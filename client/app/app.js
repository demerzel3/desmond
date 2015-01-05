(function($, angular) {

  var MainController = function($q, $injector, RulesContainer, CategoriesRepository, AccountsRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.RulesContainer = RulesContainer;
    this.categories = CategoriesRepository;
    this.accounts = AccountsRepository;
    this.files = [];
    this.movements = [];
  };
  MainController.$inject = ['$q', '$injector', 'RulesContainer', 'CategoriesRepository', 'AccountsRepository'];

  MainController.prototype.importFiles = function(account, files) {
    var ctrl = this;
    console.log('Importing files for ', account.name);
    _.each(files, function(file) {
      if ('iwbank' === account.bank) {
        if (file.type == 'application/pdf') {
          ctrl.importFile(account, file, 'IWBankEstrattoContoReader');
        } else {
          ctrl.importFile(account, file, 'IWBankListaMovimentiReader');
        }
      } else if ('bnl' === account.bank) {

      } else if ('chebanca' === account.bank) {

      }
    });
  };

  MainController.prototype.readFile = function(file, readerName) {
    var reader = this.$injector.get(readerName);
    return reader.read(file).then(function(document) {
      return document;
    });
  };

  MainController.prototype.applyAllRules = function(document) {
    var RulesContainer = this.RulesContainer;
    _.each(document.movements, function(movement) {
      RulesContainer.applyAll(movement);
    });
  };

  MainController.prototype.importFile = function(account, file, readerName) {
    var ctrl = this;
    this.readFile(file, readerName).then(function(document) {
      ctrl.applyAllRules(document);
      _.each(document.movements, function(movement) {
        movement.account = account;
      });
      ctrl.movements = _.sortBy([].concat(ctrl.movements, document.movements), function(movement) {
        return movement.date.toISOString();
      });
    });
  };

  MainController.prototype.replaceMovement = function(movement, file) {
    var ctrl = this;
    this.readFile(file, movement.replaceable.reader).then(function(document) {
      if (movement.replaceable.checker) {
        try {
          movement.replaceable.checker(movement, document);
        } catch (e) {
          sweetAlert('Oops..', e.message);
          return;
        }
      }

      ctrl.applyAllRules(document);
      _.each(document.movements, function(mov) {
        mov.account = movement.account;
      });

      // remove the replaced element from the list
      var movementIndex = ctrl.movements.indexOf(movement);
      ctrl.movements.splice(movementIndex, 1);

      // insert the new elements (in order)
      ctrl.movements = _.sortBy([].concat(ctrl.movements, document.movements), function(movement) {
        return movement.date.toISOString();
      });
    });
  };

  var Desmond = angular.module('Desmond', [
    'ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
    'Desmond.Rules', 'Desmond.Reader', 'Desmond.Model'
  ]);

  Desmond.config(['RestangularProvider', function(RestangularProvider) {
    RestangularProvider.setBaseUrl('http://127.0.0.1:8123/desmond');
    RestangularProvider.setRestangularFields({id: '_id'});

    // extract data from the list response of restheart
    RestangularProvider.addResponseInterceptor(function(data, operation, what, url, response, deferred) {
      if (operation === "getList") {
        return data['_embedded']['rh:doc'];
      } else {
        return data;
      }
    });
  }]);

  Desmond.controller('MainController', MainController);

})(window.jQuery, window.angular);