(function($, angular) {

  var IWBANK_ACCOUNT_ID = '54a6f6a30364252c133e6c94';

  var parseItalianFloat = function(value) {
    value = value.replace(/\./g, '');
    value = value.replace(/,/g, '.');
    return parseFloat(value);
  };

  var Movement = function() {
    this.accountId = null;
    this.date = moment();
    this.bankId = null;
    this.description = null;
    this.amount = 0;
    this.categoryId = null;
  };

  var MainController = function($scope, $q, Restangular) {
    this.$q = $q;
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
      ctrl.categories = categories;
    });

    $scope.$watch('ctrl.files', function(files, oldValue) {
      if (files === oldValue) {
        return;
      }
      _.each(files, function(file) {
        ctrl.importFile(file);
      });
    });
  };
  MainController.$inject = ['$scope', '$q', 'Restangular'];

  MainController.prototype.importFile = function(file) {
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
    return _.map(records, function(record) {
      var movement = new Movement();
      movement.bankId = record[5];
      movement.date = moment(record[0], 'DD/MM', 'it');
      movement.date.year(documentDate.year());
      movement.description = record[4];
      movement.amount = record[2].length > 0 ? -parseItalianFloat(record[2]) : parseItalianFloat(record[3]);
      return movement;
    });
  };

  /**
   * Looks for the specified pattern (array of strings or regular expressions) in the data (array of strings),
   * if something is found, a new array is returned containing the match, and all the data preceding and including
   * the match gets removed from the array.
   * If nothing is found, null is returned and the array is not touched.
   *
   * @param data
   * @param recordPattern
   * @param [continuationPattern]
   */
  MainController.prototype.readRecord = function(data, recordPattern, continuationPattern) {
    // match the record pattern
    var matching = 0;
    var matchIndex = -1;
    _.each(data, function(string, index) {
      if (string.match(recordPattern[matching])) {
        matching++;
      } else {
        matching = 0;
      }
      if (matching === recordPattern.length) {
        matchIndex = index - recordPattern.length + 1;
        return false;
      }
    });

    if (matchIndex == -1) {
      return null;
    }

    data.splice(0, matchIndex);
    var record = _.map(data.splice(0, recordPattern.length), function(string) {
      return string.trim();
    });
    //var result = [record];

    if (!continuationPattern) {
      return record;
    }

    // try to match the continuation pattern
    while (true) {
      var contMatching = 0;
      _.each(data, function(string, index) {
        var pattern = continuationPattern[contMatching];
        if (!pattern || string.match(pattern)) {
          contMatching++;
        } else {
          return false;
        }
        if (contMatching === continuationPattern.length) {
          return false;
        }
      });
      if (contMatching < continuationPattern.length) {
        break;
      }
      // apply continuation
      var continuation = data.splice(0, continuationPattern.length);
      record = _.map(record, function(recordValue, index) {
        var contValue = continuation[index];
        if (!contValue) {
          return recordValue;
        }
        contValue = contValue.trim();
        if (contValue.length > 0) {
          return recordValue+'\n'+contValue;
        } else {
          return recordValue;
        }
      });
      //result.push(continuation);
    }
    return record;
  };

  var Desmond = angular.module('Desmond', ['ngSanitize', 'restangular', 'angular.layout', 'angularFileUpload', 'nl2br']);

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