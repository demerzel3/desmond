(function($, angular) {

  var IWBANK_ACCOUNT_ID = '54a6f6a30364252c133e6c94';

  var MainController = function($scope, $q, $injector, Restangular, RulesContainer, CategoriesRepository) {
    this.$q = $q;
    this.$injector = $injector;
    this.RulesContainer = RulesContainer;
    this.categories = CategoriesRepository;
    this.files = [];
    this.accounts = [];
    this.movements = [];
    var ctrl = this;

    // read all accounts
    Restangular.all('accounts').getList().then(function(accounts) {
      ctrl.accounts = accounts;
    });

    $scope.$watch('ctrl.files', function(files, oldValue) {
      if (files === oldValue) {
        return;
      }
      _.each(files, function(file) {
        console.log(file);
        if (file.type == 'application/pdf') {
          ctrl.importFile(file, 'IWBankEstrattoContoReader');
        } else {
          ctrl.importFile(file, 'IWBankListaMovimentiReader');
        }
      });
    });
  };
  MainController.$inject = ['$scope', '$q', '$injector', 'Restangular', 'RulesContainer', 'CategoriesRepository'];

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

  MainController.prototype.importFile = function(file, readerName) {
    var ctrl = this;
    this.readFile(file, readerName).then(function(document) {
      ctrl.applyAllRules(document);
      ctrl.movements = _.sortBy([].concat(ctrl.movements, document.movements), function(movement) {
        return movement.date.toISOString();
      });
    });
  };

  MainController.prototype.replaceMovement = function(movement, file) {
    var ctrl = this;
    this.readFile(file, 'IWBankEstrattoContoCartaReader').then(function(document) {
      if (!movement.executionDate.isSame(document.date, 'day')
        || movement.amount != document.total) {
        console.log(movement.executionDate.format(), document.date.format());
        console.log(movement.amount, document.total);
        sweetAlert('Oops..', 'Il file non corrisponde alla riga su cui l\'hai trascinato, verifica che le date e gli importi corrispondano e riprova.');
        return;
      }

      ctrl.applyAllRules(document);

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