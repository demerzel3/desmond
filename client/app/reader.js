(function($, angular) {

  var parseItalianFloat = function(value) {
    value = value.replace(/\./g, '');
    value = value.replace(/,/g, '.');
    return parseFloat(value);
  };

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

    if (_.isArray(continuationPattern)) {
      // try to match the continuation pattern
      while (true) {
        var contMatching = 0;
        _.each(this.data, function (string, index) {
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
        record = _.map(record, function (recordValue, index) {
          var contValue = continuation[index];
          if (!contValue) {
            return recordValue;
          }
          contValue = contValue.trim();
          if (contValue.length > 0) {
            return recordValue + '\n' + contValue;
          } else {
            return recordValue;
          }
        });
        //result.push(continuation);
      }
    } else if (_.isObject(continuationPattern)
      && _.isFunction(continuationPattern.consume)
      && _.isFunction(continuationPattern.apply)) {
      var accumulator = [];
      console.log('works?', this.data[accumulator.length]);
      while (continuationPattern.consume(this.data[accumulator.length])) {
        console.log('accumulating ', this.data[accumulator.length]);
        accumulator.push(this.data[accumulator.length]);
      }
      var newRecord = continuationPattern.apply(record, accumulator);
      if (newRecord) {
        record = newRecord;
        this.data.splice(0, accumulator.length);
      }
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
      //console.log(total, "pages");

      var promises = [];
      for (var i = 1; i <= total; i++) {
        promises.push($q.when(pdf.getPage(i).then(function(page) {
          //console.log('page', page.pageNumber);
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
   * Simplifies the task of retrieving the data contained into an excel file,
   * returns an array of array of strings, representing the rows of the excel file.
   *
   * @param $q
   * @constructor
   */
  var ExcelReader = function($q) {
    this.$q = $q;
  };
  ExcelReader.$inject = ['$q'];
  ExcelReader.prototype.getFirstSheet = function(file) {
    var $q = this.$q;

    var readData = $q(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsBinaryString(file);
    });

    return readData.then(function(binaryData) {
      var workbook = XLS.read(binaryData, {type: 'binary'});
      return Papa.parse(XLS.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]])).data;
    });
  };


  var IWBankCartaReplaceHandler = function() {
    this.info = 'Trascina sulla pagina l\'estratto conto della carta di credito per caricare i dettagli';
    this.accept = 'application/pdf';
    this.readerName = 'IWBankEstrattoContoCartaReader';
  };
  IWBankCartaReplaceHandler.prototype.toString = function() {
    return 'IWBankCartaReplaceHandler';
  };
  IWBankCartaReplaceHandler.prototype.check = function(movement, document) {
    if (!movement.executionDate.isSame(document.date, 'day')
      || movement.amount != document.total) {
      console.log(movement.executionDate.format(), document.date.format());
      console.log(movement.amount, document.total);
      throw new Error('Il file non corrisponde alla riga su cui l\'hai trascinato, verifica che le date e gli importi corrispondano e riprova.');
    }
  };


  var AbstractIWBankReader = function(IWBankCartaReplaceHandler) {
    if (!IWBankCartaReplaceHandler) {
      throw new Error('LogicError: Invalid replace handler');
    }
    this.IWBankCartaReplaceHandler = IWBankCartaReplaceHandler;
  };
  AbstractIWBankReader.prototype.applyReplaceHandler = function(movement) {
    if (movement.description.indexOf('ADDEBITO ACQUISTI EFFETTUATI CON CARTA DI CREDITO') > -1) {
      // this movement is replaceable with more detailed ones, loadable from another file
      movement.replaceHandler = this.IWBankCartaReplaceHandler;
      return true;
    }
  };

  /**
   * Reads an Estratto Conto (PDF) of IWBank into a list of movements
   *
   * @constructor
   */
  var IWBankEstrattoContoReader = function(IWBankCartaReplaceHandler, PDFReader, Movement, Document) {
    AbstractIWBankReader.call(this, IWBankCartaReplaceHandler);
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  IWBankEstrattoContoReader.prototype = Object.create(AbstractIWBankReader.prototype);
  IWBankEstrattoContoReader.$inject = ['IWBankCartaReplaceHandler', 'PDFReader', 'Movement', 'Document'];
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
    var reader = this;
    var Movement = this.Movement;
    var Document = this.Document;

    return this.PDFReader.toStringArray(file).then(function(strings) {
      var consumer = new StringArrayConsumer(strings);
      var dateRecord = consumer.readRecord(self.DATE_PATTERN);
      if (!dateRecord) {
        return;
      }
      var dateString = dateRecord[0].match(self.DATE_PATTERN[0])[1];
      var documentDate = moment(dateString, 'DD/MM/YYYY');
      //console.log("document date:", documentDate.format());

      if (!consumer.readRecord(self.TABLE_START_PATTERN)) {
        return;
      }

      var records = [];
      var record = consumer.readRecord(self.RECORD_PATTERN, self.CONTINUATION_RECORD_PATTERN);
      while (record != null) {
        records.push(record);
        //console.log(record);
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
        movement.direction = (record[2].length > 0) ? Movement.DIRECTION_OUT : Movement.DIRECTION_IN;
        movement.amount = record[2].length > 0 ? -parseItalianFloat(record[2]) : parseItalianFloat(record[3]);
        reader.applyReplaceHandler(movement);
        return movement;
      });
      return new Document(file, Document.TYPE_ESTRATTO_CONTO_IWBANK, documentDate, 0, movements);
    });
  };



  var IWBankListaMovimentiReader = function(IWBankCartaReplaceHandler, ExcelReader, Movement, Document) {
    AbstractIWBankReader.call(this, IWBankCartaReplaceHandler);
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  IWBankListaMovimentiReader.prototype = Object.create(AbstractIWBankReader.prototype);
  IWBankListaMovimentiReader.$inject = ['IWBankCartaReplaceHandler', 'ExcelReader', 'Movement', 'Document'];
  IWBankListaMovimentiReader.prototype.read = function(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    var reader = this;
    return this.ExcelReader.getFirstSheet(file).then(function(rows) {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_IWBANK);
      _.each(rows, function(row) {
        if (row.length < 8) {
          return;
        }
        if (!row[0] || row[0].trim().length == 0) {
          return;
        }
        if (row[0] === 'Estrazione Dal' && row[2] === 'Al') {
          document.date = moment(row[1], 'DD/MM/YYYY');
        }
        if (!reading
          && angular.equals(row, ["CC", "DATA_CONTABILE", "DATA_VALUTA", "CAUSALE", "SEGNO", "IMPORTO", "CATEGORIA", "NOTE"])) {
          reading = true;
          return;
        }
        if (!reading) {
          return;
        }

        // read a record into a movement
        var movement = new Movement();
        movement.document = document;
        movement.bankId = null;
        movement.date = moment(row[1], 'DD/MM/YYYY', 'it');
        movement.executionDate = moment(row[2], 'DD/MM/YYYY', 'it');
        movement.description = row[3];
        movement.direction = (row[4] === '-') ? Movement.DIRECTION_OUT : Movement.DIRECTION_IN;
        movement.amount = (row[4] === '-' ? -1 : 1)*parseFloat(row[5]);
        reader.applyReplaceHandler(movement);
        document.movements.push(movement);
      });
      return document;
    });
  };



  var BNLListaMovimentiReader = function(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  BNLListaMovimentiReader.$inject = ['ExcelReader', 'Movement', 'Document'];
  BNLListaMovimentiReader.prototype.read = function(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then(function(rows) {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_BNL);
      _.each(rows, function(row) {
        if (row.length < 5) {
          return;
        }
        if (!row[0] || row[0].trim().length == 0) {
          return;
        }
        if (row[0] === 'Saldo Contabile al:') {
          document.date = moment(row[1], 'DD/MM/YYYY');
        }
        if (!reading
          && angular.equals(row, ["Data contabile", "Data valuta", "Causale ABI", "Descrizione", "Importo"])) {
          reading = true;
          return;
        }
        if (!reading) {
          return;
        }

        // read a record into a movement
        var movement = new Movement();
        movement.document = document;
        movement.bankId = null;
        movement.date = moment(row[0], 'DD/MM/YYYY', 'it');
        movement.executionDate = moment(row[1], 'DD/MM/YYYY', 'it');
        movement.description = row[3];
        movement.direction = (row[4][0] === '+') ? Movement.DIRECTION_IN : Movement.DIRECTION_OUT;
        movement.amount = parseFloat(row[4].replace(/--/g, '-').replace(/,/g, ''));
        document.movements.push(movement);
      });
      return document;
    });
  };



  var IWBankEstrattoContoCartaReader = function(PDFReader, Movement, Document) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  IWBankEstrattoContoCartaReader.$inject = ['PDFReader', 'Movement', 'Document'];
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
    var Document = this.Document;

    return this.PDFReader.toStringArray(file).then(function(strings) {
      var consumer = new StringArrayConsumer(strings);
      //console.log(strings);

      if (!consumer.readRecord(self.TABLE_START_PATTERN)) {
        throw new Error('Unable to find the start pattern');
      }

      var records = [];
      var record = consumer.readRecord(self.RECORD_PATTERN);
      while (record != null) {
        records.push(record);
        //console.log(record);
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
        movement.direction = Movement.DIRECTION_OUT;
        movement.amount = -parseItalianFloat(record[3]);
        return movement;
      });
      return new Document(file, Document.TYPE_ESTRATTO_CONTO_CARTA_IW, documentDate, documentTotal, movements);
    });
  };


  var IWPowerListaMovimentiReader = function(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  IWPowerListaMovimentiReader.$inject = ['ExcelReader', 'Movement', 'Document'];
  IWPowerListaMovimentiReader.prototype.read = function(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then(function(rows) {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_IWPOWER);
      _.each(rows, function(row) {
        if (row.length < 5) {
          return;
        }
        if (!row[0] || row[0].trim().length == 0) {
          return;
        }
        if (row[0] === 'Estrazione Dal' && row[2] === 'Al') {
          document.date = moment(row[1], 'DD_MM_YYYY');
        }
        if (!reading
          && angular.equals(row, ["Data", "Valuta", "[#IMPORTO_IN]", "[#IMPORTO_OUT]", "Causale"])) {
          reading = true;
          return;
        }
        if (!reading) {
          return;
        }

        // read a record into a movement
        var movement = new Movement();
        movement.document = document;
        movement.bankId = null;
        movement.date = moment(row[0], 'DD/MM/YY', 'it');
        movement.executionDate = moment(row[1], 'DD/MM/YY', 'it');
        movement.description = row[4];
        movement.direction = (row[2].length > 0) ? Movement.DIRECTION_IN : Movement.DIRECTION_OUT;
        movement.amount = (row[2].length > 0) ? parseFloat(row[2]) : -parseFloat(row[3]);
        document.movements.push(movement);
      });
      return document;
    });
  };



  /**
   * Reads an Estratto Conto (PDF) of IWBank into a list of movements
   *
   * @constructor
   */
  var IntesaEstrattoContoReader = function(PDFReader, Movement, Document) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  };
  IntesaEstrattoContoReader.$inject = ['PDFReader', 'Movement', 'Document'];
  IntesaEstrattoContoReader.DATE_PATTERN = [/^ESTRATTO CONTO N.  [0-9]{3}\/[0-9]{4}$/, /^AL  ([0-9]{2}\.[0-9]{2}\.[0-9]{4})$/];
  IntesaEstrattoContoReader.TABLE_START_PATTERN = ["Data Operazione", "Data Valuta", "Descrizione", "      Addebiti", "     Accrediti"];
  IntesaEstrattoContoReader.RECORD_PATTERN = [
    /^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/, // data operazione
    /^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/, // data valuta
    /\S+/, // descrizione
    /^[0-9\.,\s]+$/, // addebiti
    /^[0-9\.,\s]+$/ // accrediti
  ];

  /**
   * @param file
   * @returns {Promise|*}
   */
  IntesaEstrattoContoReader.prototype.read = function(file) {
    var self = IntesaEstrattoContoReader;
    var Movement = this.Movement;
    var Document = this.Document;

    var consecutiveSpaces = 0;
    var continuationConfig = {
      // breaks accumulation when two consecutive spaces are found
      consume: function(string) {
        if (string.trim() === 0) {
          consecutiveSpaces++;
        } else {
          consecutiveSpaces = 0;
        }
        return consecutiveSpaces < 2
          && (string !== 'Totali')
          && !string.match(/^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/)
          && !string.match(/^Pagina\s+[0-9]+\s+di\s+[0-9]+/);
      },
      // applies continuation
      apply: function(record, accumulator) {
        consecutiveSpaces = 0;
        accumulator = _.filter(accumulator, function(descr) {
          return descr.trim().length > 0;
        });
        record[2] = [record[2]].concat(accumulator).join('\n');
        return record;
      }
    };

    return this.PDFReader.toStringArray(file).then(function(strings) {
      console.log(strings);
      var consumer = new StringArrayConsumer(strings);
      var dateRecord = consumer.readRecord(self.DATE_PATTERN);
      if (!dateRecord) {
        return;
      }
      var dateString = dateRecord[1].match(self.DATE_PATTERN[1])[1];
      var documentDate = moment(dateString, 'DD.MM.YYYY');
      console.log("document date:", documentDate.format());

      if (!consumer.readRecord(self.TABLE_START_PATTERN)) {
        console.log('table start pattern not found');
        return;
      }

      var records = [];
      var record = consumer.readRecord(self.RECORD_PATTERN, continuationConfig);
      console.log(record);
      while (record != null) {
        records.push(record);
        record = consumer.readRecord(self.RECORD_PATTERN, continuationConfig);
      }

      // convert records to movements
      var movements = _.map(records, function(record) {
        var movement = new Movement();
        movement.bankId = record[5];
        movement.date = moment(record[0], 'DD.MM.YYYY', 'it');
        movement.executionDate = moment(record[1], 'DD.MM.YYYY', 'it');
        movement.date.year(documentDate.year());
        movement.description = record[2];
        movement.direction = (record[3].length > 0) ? Movement.DIRECTION_OUT : Movement.DIRECTION_IN;
        movement.amount = record[3].length > 0 ? -parseItalianFloat(record[3]) : parseItalianFloat(record[4]);
        return movement;
      });
      return new Document(file, Document.TYPE_ESTRATTO_CONTO_INTESA, documentDate, 0, movements);
    });
  };


  var Reader = angular.module('Desmond.Reader', []);
  Reader.service('PDFReader', PDFReader);
  Reader.service('ExcelReader', ExcelReader);
  Reader.service('IWBankEstrattoContoReader', IWBankEstrattoContoReader);
  Reader.service('IWBankListaMovimentiReader', IWBankListaMovimentiReader);
  Reader.service('IWPowerListaMovimentiReader', IWPowerListaMovimentiReader);
  Reader.service('BNLListaMovimentiReader', BNLListaMovimentiReader);
  Reader.service('IntesaEstrattoContoReader', IntesaEstrattoContoReader);

  Reader.service('IWBankCartaReplaceHandler', IWBankCartaReplaceHandler);
  Reader.service('IWBankEstrattoContoCartaReader', IWBankEstrattoContoCartaReader);

})(window.jQuery, window.angular);