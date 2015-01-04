(function($, angular) {

  var IWBANK_ACCOUNT_ID = '54a6f6a30364252c133e6c94';

  var MainController = function($scope, $q, $injector, Restangular, RulesContainer) {
    this.$q = $q;
    this.$injector = $injector;
    this.RulesContainer = RulesContainer;
    this.files = [];
    this.accounts = [];
    this.categories = [];
    this.movements = [];
    var ctrl = this;

    // read all accounts
    Restangular.all('accounts').getList().then(function(accounts) {
      ctrl.accounts = accounts;
    });

    // read all categories
    Restangular.all('categories').getList({sort_by: 'name'}).then(function(categories) {
      // index categories by id
      var catById = {};
      _.each(categories, function(category) {
        catById[category._id] = category;
      });
      ctrl.categories = catById;
    });

    $scope.$watch('ctrl.files', function(files, oldValue) {
      if (files === oldValue) {
        return;
      }
      _.each(files, function(file) {
        ctrl.importFile(file, 'IWBankEstrattoContoReader');
      });
    });
  };
  MainController.$inject = ['$scope', '$q', '$injector', 'Restangular', 'RulesContainer'];

  MainController.prototype.importFile = function(file, handlerName) {
    var RulesContainer = this.RulesContainer;
    var handler = this.$injector.get(handlerName);
    var ctrl = this;
    handler.read(file).then(function(movements) {
      _.each(movements, function(movement) {
        RulesContainer.applyAll(movement);
      });
      ctrl.movements = _.sortBy([].concat(ctrl.movements, movements), function(movement) {
        return movement.date.toISOString();
      });
    });
    /*
    var ctrl = this;
    var $q = this.$q;
    var readData = $q(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsArrayBuffer(file);
    });

    readData.then(function(data) {
      return PDFJS.getDocument(data);
    }).then(function(pdf) {
      var total = pdf.numPages;
      console.log(total, "pages");

      var promises = [];
      for (var i = 1; i <= total; i++) {
        promises.push($q.when(pdf.getPage(i).then(function(page) {
          console.log('page', page.pageNumber);
          return page.getTextContent();
        }, function(pageErr) {
          console.error(pageErr);
        }).then(function(textContent) {
          return _.map(textContent.items, function(item) {
            return item.str;
          });
        }, function(err) {
          console.error(err);
        })));
      }

      return $q.all(promises);
    }).then(function(pagesStrings) {
      // strings are arrays of arrays of strings that must be merged into a single array
      return _.reduce(pagesStrings, function(list, pageStrings) {
        return list.concat(pageStrings);
      }, []);
    }).then(function(strings) {
      return ctrl.parseIWBank(strings);
    }).then(function(movements) {
      ctrl.movements = _.sortBy([].concat(ctrl.movements, movements), function(movement) {
        return movement.date.toISOString();
      });
    });
    */
  };

  MainController.prototype.parseIWBank = function(strings) {
    var datePattern = [/^ESTRATTO AL ([0-9]{2}\/[0-9]{2}\/[0-9]{4})$/];
    var startPattern = ["DATA", "VALUTA", "DARE", "AVERE", "DESCRIZIONE", "N. OPERAZIONE"];
    var recordPattern = [
      /^[0-9]{2}\/[0-9]{2}$/, // data
      /^[0-9]{2}\/[0-9]{2}\/[0-9]{2}$/, // valuta
      /^[0-9\., ]{16}$/, // dare
      /^[0-9\., ]{16}$/, // avere
      /\S+/, // descrizione
      /^\S+$/ // n. operazione
    ];
    var continuationRecordPattern = [
      /^[\s]{5}$/, // data
      /^[\s]{8}$/, // valuta
      /^[\s]{16}$/, // dare
      /^[\s]{16}$/, // avere
      /\S+/, // descrizione
      null // n. operazione
    ];


    var dateRecord = this.readRecord(strings, datePattern);
    if (!dateRecord) {
      return;
    }
    var dateString = dateRecord[0].match(datePattern[0])[1];
    var documentDate = moment(dateString, 'DD/MM/YYYY');
    console.log("document date:", documentDate.format());

    if (!this.readRecord(strings, startPattern)) {
      return;
    }

    var records = [];
    var record = this.readRecord(strings, recordPattern, continuationRecordPattern);
    while (record != null) {
      records.push(record);
      console.log(record);
      record = this.readRecord(strings, recordPattern, continuationRecordPattern);
    }

    // convert records to movements
    var RulesContainer = this.RulesContainer;
    return _.map(records, function(record) {
      var movement = new Movement();
      movement.bankId = record[5];
      movement.date = moment(record[0], 'DD/MM', 'it');
      movement.date.year(documentDate.year());
      movement.description = record[4];
      movement.amount = record[2].length > 0 ? -parseItalianFloat(record[2]) : parseItalianFloat(record[3]);
      RulesContainer.applyAll(movement);
      return movement;
    });
  };

  var Desmond = angular.module('Desmond', [
    'ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br',
    'Desmond.Rules', 'Desmond.Reader', 'Desmond.Model'
  ]);

  Desmond.config(['RestangularProvider', function(RestangularProvider) {
    console.log("Configuring restangular!");
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