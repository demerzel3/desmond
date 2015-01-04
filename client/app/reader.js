(function($, angular) {

  var parseItalianFloat = function(value) {
    value = value.replace(/\./g, '');
    value = value.replace(/,/g, '.');
    return parseFloat(value);
  };

  /**
   * Represents an imported document, that is probably a file.
   * Three key pieces of information are coded as properties here:
   *  - document type (e.g. the source of this document)
   *  - date of the document
   *  - total amount of the document
   * Everything else can be freely stored in 'metadata'.
   *
   * @param documentType
   * @param date
   * @param total
   * @param movements
   * @param metadata could be anything
   * @constructor
   */
  var ImportedDocument = function(documentType, date, total, movements, metadata) {
    this.documentType = documentType;
    this.date = date;
    this.total = total;
    this.movements = movements;
    this.metadata = metadata;
  };
  ImportedDocument.TYPE_ESTRATTO_CONTO_IWBANK = 'EstrattoContoIWBank';
  ImportedDocument.TYPE_ESTRATTO_CONTO_CARTA_IW = 'EstrattoContoCartaIW';


  var StringArrayConsumer = function(input) {
    // make a copy of the input, since it will be "consumed"
    this.data = [].concat(input);
  };
  /**
   * Looks for the specified pattern (array of strings or regular expressions) in the input.
   * If something is found, a new array is returned containing the match, and the input pointer is moved forward.
   * If nothing is found, nothing gets changed.
   *
   * @param recordPattern
   * @param [continuationPattern]
   */
  StringArrayConsumer.prototype.readRecord = function(recordPattern, continuationPattern) {
    // match the record pattern
    var matching = 0;
    var matchIndex = -1;
    _.each(this.data, function(string, index) {
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

    this.data.splice(0, matchIndex);
    var record = _.map(this.data.splice(0, recordPattern.length), function(string) {
      return string.trim();
    });
    //var result = [record];

    if (!continuationPattern) {
      return record;
    }

    // try to match the continuation pattern
    while (true) {
      var contMatching = 0;
      _.each(this.data, function(string, index) {
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
      var continuation = this.data.splice(0, continuationPattern.length);
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

  var PDFReader = function($q) {
    this.$q = $q;
  };
  PDFReader.$inject = ['$q'];

  /**
   * Reads a PDF file to an array of strings
   *
   * @param file
   * @return Promise
   */
  PDFReader.prototype.toStringArray = function(file) {
    var $q = this.$q;
    var readData = $q(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsArrayBuffer(file);
    });

    return readData.then(function(data) {
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
    });
  };


  /**
   * Reads an Estratto Conto (PDF) of IWBank into a list of movements
   *
   * @constructor
   */
  var IWBankEstrattoContoReader = function(PDFReader, Movement) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
  };
  IWBankEstrattoContoReader.$inject = ['PDFReader', 'Movement'];
  IWBankEstrattoContoReader.DATE_PATTERN = [/^ESTRATTO AL ([0-9]{2}\/[0-9]{2}\/[0-9]{4})$/];
  IWBankEstrattoContoReader.TABLE_START_PATTERN = ["DATA", "VALUTA", "DARE", "AVERE", "DESCRIZIONE", "N. OPERAZIONE"];
  IWBankEstrattoContoReader.RECORD_PATTERN = [
    /^[0-9]{2}\/[0-9]{2}$/, // data
    /^[0-9]{2}\/[0-9]{2}\/[0-9]{2}$/, // data valuta
    /^[0-9\., ]{16}$/, // dare
    /^[0-9\., ]{16}$/, // avere
    /\S+/, // descrizione
    /^\S+$/ // n. operazione
  ];
  IWBankEstrattoContoReader.CONTINUATION_RECORD_PATTERN = [
    /^[\s]{5}$/, // data
    /^[\s]{8}$/, // data valuta
    /^[\s]{16}$/, // dare
    /^[\s]{16}$/, // avere
    /\S+/, // descrizione
    null // n. operazione
  ];

  /**
   * @param file
   * @returns {Promise|*}
   */
  IWBankEstrattoContoReader.prototype.read = function(file) {
    var self = IWBankEstrattoContoReader;
    var Movement = this.Movement;

    return this.PDFReader.toStringArray(file).then(function(strings) {
      var consumer = new StringArrayConsumer(strings);
      var dateRecord = consumer.readRecord(self.DATE_PATTERN);
      if (!dateRecord) {
        return;
      }
      var dateString = dateRecord[0].match(self.DATE_PATTERN[0])[1];
      var documentDate = moment(dateString, 'DD/MM/YYYY');
      console.log("document date:", documentDate.format());

      if (!consumer.readRecord(self.TABLE_START_PATTERN)) {
        return;
      }

      var records = [];
      var record = consumer.readRecord(self.RECORD_PATTERN, self.CONTINUATION_RECORD_PATTERN);
      while (record != null) {
        records.push(record);
        console.log(record);
        record = consumer.readRecord(self.RECORD_PATTERN, self.CONTINUATION_RECORD_PATTERN);
      }

      // convert records to movements
      var movements = _.map(records, function(record) {
        var movement = new Movement();
        movement.bankId = record[5];
        movement.date = moment(record[0], 'DD/MM', 'it');
        movement.executionDate = moment(record[1], 'DD/MM/YY', 'it');
        movement.date.year(documentDate.year());
        movement.description = record[4];
        movement.amount = record[2].length > 0 ? -parseItalianFloat(record[2]) : parseItalianFloat(record[3]);
        return movement;
      });
      return new ImportedDocument(ImportedDocument.TYPE_ESTRATTO_CONTO_IWBANK, documentDate, 0, movements);
    });
  };



  var IWBankEstrattoContoCartaReader = function(PDFReader, Movement) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
  };
  IWBankEstrattoContoCartaReader.$inject = ['PDFReader', 'Movement'];
  IWBankEstrattoContoCartaReader.DATE_TOTAL_PATTERN = [/Addebito in conto corrente il ([0-9]{2}\/[0-9]{2}\/[0-9]{4})/, '(c)', /^[0-9\.,]+$/]
  IWBankEstrattoContoCartaReader.TABLE_START_PATTERN = [
    "Data operazione",
    "Data registrazione",
    "Descrizione",
    "Importo in Euro",
    "Importo valuta originale"
  ];
  IWBankEstrattoContoCartaReader.RECORD_PATTERN = [
    /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data operazione
    /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data registrazione
    /\S+/, // descrizione
    /^[0-9\.,\s]+$/, // importo in euro
    /^[0-9\.,\s]*$/ // importo in valuta originale
  ];

  /**
   *
   * @param file
   * @returns {Promise|*}
   */
  IWBankEstrattoContoCartaReader.prototype.read = function(file) {
    var self = IWBankEstrattoContoCartaReader;
    var Movement = this.Movement;

    return this.PDFReader.toStringArray(file).then(function(strings) {
      var consumer = new StringArrayConsumer(strings);
      console.log(strings);

      if (!consumer.readRecord(self.TABLE_START_PATTERN)) {
        throw new Error('Unable to find the start pattern');
      }

      var records = [];
      var record = consumer.readRecord(self.RECORD_PATTERN);
      while (record != null) {
        records.push(record);
        console.log(record);
        record = consumer.readRecord(self.RECORD_PATTERN);
      }

      // read document date and total
      var dateTotal = consumer.readRecord(self.DATE_TOTAL_PATTERN);
      if (!dateTotal) {
        throw new Error('Unable to find the date/total pattern');
      }
      var documentDate = moment(dateTotal[0].match(self.DATE_TOTAL_PATTERN[0])[1], 'DD/MM/YYYY', 'it');
      var documentTotal = -parseItalianFloat(dateTotal[2]);

      // convert records to movements
      var movements = _.map(records, function(record) {
        var movement = new Movement();
        movement.bankId = null;
        movement.date = moment(record[0], 'DD/MM/YYYY', 'it');
        movement.executionDate = moment(record[1], 'DD/MM/YYYY', 'it');
        movement.description = 'ACQUISTO CARTA DI CREDITO\n'+record[2];
        movement.amount = -parseItalianFloat(record[3]);
        return movement;
      });
      return new ImportedDocument(ImportedDocument.TYPE_ESTRATTO_CONTO_CARTA_IW, documentDate, documentTotal, movements);
    });
  };

  var Reader = angular.module('Desmond.Reader', []);
  Reader.service('PDFReader', PDFReader);
  Reader.service('IWBankEstrattoContoReader', IWBankEstrattoContoReader);
  Reader.service('IWBankEstrattoContoCartaReader', IWBankEstrattoContoCartaReader);

})(window.jQuery, window.angular);