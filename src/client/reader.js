
let parseItalianFloat = (value) => {
  value = value.replace(/\./g, '');
  value = value.replace(/,/g, '.');
  return parseFloat(value);
};

/**
 * From http://stackoverflow.com/questions/16229494/converting-excel-date-serial-number-to-date-using-javascript
 *
 * @param serial
 * @returns {Date}
 */
let excelDateToJSDate = (serial) => {
   var utc_days  = Math.floor(serial - 25569);
   var utc_value = utc_days * 86400;
   var date_info = new Date(utc_value * 1000);

   var fractional_day = serial - Math.floor(serial) + 0.0000001;

   var total_seconds = Math.floor(86400 * fractional_day);

   var seconds = total_seconds % 60;

   total_seconds -= seconds;

   var hours = Math.floor(total_seconds / (60 * 60));
   var minutes = Math.floor(total_seconds / 60) % 60;

   return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
};

class StringArrayConsumer {
  constructor(input) {
    // make a copy of the input, since it will be "consumed"
    this.data = [].concat(input);
  }

  /**
   * Looks for the specified pattern (array of strings or regular expressions) in the input.
   * If something is found, a new array is returned containing the match, and the input pointer is moved forward.
   * If nothing is found, nothing gets changed.
   *
   * @param recordPattern
   * @param [continuationPattern]
   */
  readRecord(recordPattern, continuationPattern) {
    // match the record pattern
    var matching = 0;
    var matchIndex = -1;
    for (let index = 0; index < this.data.length; index++) {
      let string = this.data[index];
      if (string.match(recordPattern[matching])) {
        matching++;
      } else {
        matching = 0;
      }
      if (matching === recordPattern.length) {
        matchIndex = index - recordPattern.length + 1;
        break;
      }
    }

    if (matchIndex == -1) {
      return null;
    }

    this.data.splice(0, matchIndex);
    var record = this.data.splice(0, recordPattern.length).map((string) => {
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
        for (let string of this.data) {
          var pattern = continuationPattern[contMatching];
          if (!pattern || string.match(pattern)) {
            contMatching++;
          } else {
            break;
          }
          if (contMatching === continuationPattern.length) {
            break;
          }
        }
        if (contMatching < continuationPattern.length) {
          break;
        }
        // apply continuation
        var continuation = this.data.splice(0, continuationPattern.length);
        record = record.map((recordValue, index) => {
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
      }
    } else if (_.isObject(continuationPattern)
      && _.isFunction(continuationPattern.consume)
      && _.isFunction(continuationPattern.apply)) {
      var accumulator = [];
      while (continuationPattern.consume(this.data[accumulator.length])) {
        accumulator.push(this.data[accumulator.length]);
      }
      var newRecord = continuationPattern.apply(record, accumulator);
      if (newRecord) {
        record = newRecord;
        this.data.splice(0, accumulator.length);
      }
    }
    return record;
  }
}



class PDFReader {
  constructor($q) {
    this.$q = $q;
  };

  /**
   * Reads a PDF file to an array of strings
   *
   * @param file
   * @return Promise
   */
  toStringArray(file) {
    var $q = this.$q;
    var readData = $q((resolve, reject) => {
      var reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      reader.readAsArrayBuffer(file);
    });

    return readData.then((data) => {
      return PDFJS.getDocument(data);
    }).then((pdf) => {
      var total = pdf.numPages;
      //console.log(total, "pages");

      var promises = [];
      for (var i = 1; i <= total; i++) {
        promises.push($q.when(pdf.getPage(i).then((page) => {
          //console.log('page', page.pageNumber);
          return page.getTextContent();
        }, (pageErr) => {
          console.error(pageErr);
        }).then((textContent) => {
          return textContent.items.map((item) => {
            return item.str;
          });
        }, (err) => {
          console.error(err);
        })));
      }

      return $q.all(promises);
    }).then((pagesStrings) => {
      // strings are arrays of arrays of strings that must be merged into a single array
      return pagesStrings.reduce((list, pageStrings) => list.concat(pageStrings), []);
    });
  }
}
PDFReader.$inject = ['$q'];



/**
 * Simplifies the task of retrieving the data contained into an excel file,
 * returns an array of array of strings, representing the rows of the excel file.
 */
class ExcelReader {
  constructor($q) {
    this.$q = $q;
  }

  getFirstSheet(file) {
    var $q = this.$q;

    var readData = $q((resolve, reject) => {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsBinaryString(file);
    });

    return readData.then(binaryData => {
      let workbook = XLS.read(binaryData, {type: 'binary'});
      let sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Extend reference range to capture all filled cells.
      let range = sheet['!ref'].match(/([A-Z]+)[0-9]+:([A-Z]+)([0-9]+)/);
      let firstColumn = range[1];
      let lastColumn = range[2];
      var lastRow = range[3];

      // If on the first column there is nothing, move the pointer to the following.
      let somethingFound = false;
      while (!somethingFound && firstColumn !== lastColumn) {
        for (let i = 1; i <= lastRow; i++) {
          if (sheet[firstColumn + '' + i]) {
            console.log('something found at ', firstColumn, i);
            somethingFound = true;
            break;
          }
        }

        if (!somethingFound) {
          firstColumn = String.fromCharCode(firstColumn.charCodeAt(0) + 1);
        }
      }

      console.log('firstColumn', firstColumn, 'lastRow', lastRow);
      while (sheet[firstColumn + '' + lastRow]) {
        lastRow++;
      }
      sheet['!ref'] = firstColumn + sheet['!ref'].replace(/[A-Z]+([0-9]+:[A-Z]+)[0-9]+/, '$1') + lastRow;

      return this._sheetToJson(sheet);
    });
  }

  _sheetToJson(sheet) {
    let range = XLSX.utils.decode_range(sheet['!ref']);
    let result = [];
    for (let row = range.s.r; row <= range.e.r; row++) {
      let rowData = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        rowData.push(XLSX.utils.format_cell(sheet[XLSX.utils.encode_cell({r: row, c: col})]));
      }
      result.push(rowData);
    }
    console.log(range);
    return result;
  }
}
ExcelReader.$inject = ['$q'];


class IWBankCartaReplaceHandler {
  constructor() {
    this.info = 'Trascina sulla pagina l\'estratto conto della carta di credito per caricare i dettagli';
    this.accept = 'application/pdf';
    this.readerName = 'IWBankEstrattoContoCartaReader';
  }

  toString() {
    return 'IWBankCartaReplaceHandler';
  }

  check(movement, document) {
    if (!movement.executionDate.isSame(document.date, 'day')
      || movement.amount != document.total) {
      console.log(movement.executionDate.format(), document.date.format());
      console.log(movement.amount, document.total);
      throw new Error('Il file non corrisponde alla riga su cui l\'hai trascinato, verifica che le date e gli importi corrispondano e riprova.');
    }
  }
}

class WidibaCartaReplaceHandler {
  constructor() {
    this.info = 'Trascina sulla pagina l\'estratto conto della carta di credito per caricare i dettagli';
    this.accept = 'application/*';
    this.readerName = 'WidibaListaMovimentiCartaReader';
  }

  toString() {
    return 'WidibaCartaReplaceHandler';
  }

  check(movement, document) {
    if (movement.amount.toFixed(2) !== document.total.toFixed(2)) {
      console.log(movement.amount, document.total);
      throw new Error('Il file non corrisponde alla riga su cui l\'hai trascinato, verifica che gli importi corrispondano e riprova.');
    }
    document.date = movement.date;
  }
}



class AbstractIWBankReader {
  constructor(IWBankCartaReplaceHandler) {
    if (!IWBankCartaReplaceHandler) {
      throw new Error('LogicError: Invalid replace handler');
    }
    this.IWBankCartaReplaceHandler = IWBankCartaReplaceHandler;
  }

  applyReplaceHandler(movement) {
    if (movement.description.indexOf('ADDEBITO ACQUISTI EFFETTUATI CON CARTA DI CREDITO') > -1
      || movement.description.indexOf('ADD. CARTA UBI BANCA') > -1) {
      // this movement is replaceable with more detailed ones, loadable from another file
      movement.replaceHandler = this.IWBankCartaReplaceHandler;
      return true;
    }
  };
}



/**
 * Reads an Estratto Conto (PDF) of IWBank into a list of movements
 */
class IWBankEstrattoContoReader extends AbstractIWBankReader {
  constructor(IWBankCartaReplaceHandler, PDFReader, Movement, Document) {
    super(IWBankCartaReplaceHandler);
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  /**
   * @param file
   * @returns {Promise|*}
   */
  read(file) {
    var self = IWBankEstrattoContoReader;
    var Movement = this.Movement;
    var Document = this.Document;

    return this.PDFReader.toStringArray(file).then((strings) => {
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
      var movements = records.map((record) => {
        var movement = new Movement();
        movement.bankId = record[5];
        movement.date = moment(record[0], 'DD/MM', 'it');
        movement.executionDate = moment(record[1], 'DD/MM/YY', 'it');
        movement.date.year(documentDate.year());
        movement.description = record[4];
        movement.direction = (record[2].length > 0) ? Movement.DIRECTION_OUT : Movement.DIRECTION_IN;
        movement.amount = record[2].length > 0 ? -parseItalianFloat(record[2]) : parseItalianFloat(record[3]);
        this.applyReplaceHandler(movement);
        return movement;
      });
      return new Document(file, Document.TYPE_ESTRATTO_CONTO_IWBANK, documentDate, 0, movements);
    });
  }
}
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



class IWBankListaMovimentiReader extends AbstractIWBankReader {
  constructor(IWBankCartaReplaceHandler, ExcelReader, Movement, Document) {
    super(IWBankCartaReplaceHandler);
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  read(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then((rows) => {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_IWBANK);

      for (let row of rows) {
        if (row.length < 8) {
          continue;
        }
        if (!row[0] || row[0].trim().length == 0) {
          continue;
        }
        if (row[0] === 'Estrazione Dal' && row[2] === 'Al') {
          document.date = moment(row[1], 'DD/MM/YYYY');
        }
        if (!reading
          && angular.equals(row, ["CC", "DATA_CONTABILE", "DATA_VALUTA", "CAUSALE", "SEGNO", "IMPORTO", "CATEGORIA", "NOTE"])) {
          reading = true;
          continue;
        }
        if (!reading) {
          continue;
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
        this.applyReplaceHandler(movement);
        document.movements.push(movement);
      }
      return document;
    });
  }
}
IWBankListaMovimentiReader.$inject = ['IWBankCartaReplaceHandler', 'ExcelReader', 'Movement', 'Document'];



class BNLListaMovimentiReader {
  constructor(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  read(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then((rows) => {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_BNL);

      for (let row of rows) {
        if (row.length < 5) {
          continue;
        }
        if (!row[0] || row[0].trim().length == 0) {
          continue;
        }
        if (row[0] === 'Saldo Contabile al:') {
          document.date = moment(row[1], 'DD/MM/YYYY');
        }
        if (!reading
          && angular.equals(row, ["Data contabile", "Data valuta", "Causale ABI", "Descrizione", "Importo"])) {
          reading = true;
          continue;
        }
        if (!reading) {
          continue;
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
      }
      return document;
    });
  }
}
BNLListaMovimentiReader.$inject = ['ExcelReader', 'Movement', 'Document'];


/**
 * Versioned reader for IWBank card.
 */
class IWBankEstrattoContoCartaReader {
  constructor(ReaderV1, ReaderV2) {
    this.readers = [ReaderV2, ReaderV1];
  }

  read(file) {
    var lastError = null;
    for (let reader of this.readers) {
      try {
        return reader.read(file);
      } catch (e) {
        // Save the last error while trying with the next reader.
        lastError = e;
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}
IWBankEstrattoContoCartaReader.$inject = ['IWBankEstrattoContoCartaReaderV1', 'IWBankEstrattoContoCartaReaderV2'];

class IWBankEstrattoContoCartaReaderV2 {
  constructor(PDFReader, Movement, Document) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  /**
   *
   * @param file
   * @returns {Promise|*}
   */
  read(file) {
    var self = IWBankEstrattoContoCartaReaderV2;
    var Movement = this.Movement;
    var Document = this.Document;

    return this.PDFReader.toStringArray(file).then((strings) => {
      var consumer = new StringArrayConsumer(strings);
      console.log(strings);

      var dateMatch = consumer.readRecord(self.DATE_PATTERN);
      if (!dateMatch) {
        throw new Error('Unable to find the date pattern');
      }

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
      var totalMatch = consumer.readRecord(self.TOTAL_PATTERN);
      if (!totalMatch) {
        throw new Error('Unable to find the total pattern');
      }
      var documentDate = moment(dateMatch[2], 'DD.MM.YYYY', 'it');
      var documentTotal = -parseItalianFloat(totalMatch[1]);

      // convert records to movements
      var movements = records.map((record) => {
        var movement = new Movement();
        movement.bankId = record[0];
        movement.date = moment(record[1], 'DD/MM/YYYY', 'it');
        movement.executionDate = moment(record[2], 'DD/MM/YYYY', 'it');
        movement.description = 'ACQUISTO CARTA DI CREDITO\n'+record[3];
        movement.direction = Movement.DIRECTION_OUT;
        movement.amount = -parseItalianFloat(record[4]);
        return movement;
      });
      return new Document(file, Document.TYPE_ESTRATTO_CONTO_CARTA_IW, documentDate, documentTotal, movements);
    });
  }
}
IWBankEstrattoContoCartaReaderV2.$inject = ['PDFReader', 'Movement', 'Document'];
IWBankEstrattoContoCartaReaderV2.DATE_PATTERN = ["Data di addebito sul conto", "corrente:", /^[0-9]{2}\.[0-9]{2}\.[0-9]{4}$/];
IWBankEstrattoContoCartaReaderV2.TOTAL_PATTERN = ["SALDO ATTUALE A VS. DEBITO", /^[0-9\.,]+$/]
IWBankEstrattoContoCartaReaderV2.TABLE_START_PATTERN = [
  "CODICE RIFERIMENTO",
  "DATA", "OPERAZIONE",
  "DATA", "REGISTRAZIONE",
  "DESCRIZIONE DELLE OPERAZIONI",
  "IMPORTO IN EURO"
];
IWBankEstrattoContoCartaReaderV2.RECORD_PATTERN = [
  /^[0-9 ]*$/, // codice riferimento (numbers and spaces)
  /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data operazione
  /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data registrazione
  /\S+/, // descrizione
  /^[0-9\.,\s]+$/  // importo in euro
];

class IWBankEstrattoContoCartaReaderV1 {
  constructor(PDFReader, Movement, Document) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  /**
   *
   * @param file
   * @returns {Promise|*}
   */
  read(file) {
    var self = IWBankEstrattoContoCartaReaderV1;
    var Movement = this.Movement;
    var Document = this.Document;

    return this.PDFReader.toStringArray(file).then((strings) => {
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
      var movements = records.map((record) => {
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
  }
}
IWBankEstrattoContoCartaReaderV1.$inject = ['PDFReader', 'Movement', 'Document'];
IWBankEstrattoContoCartaReaderV1.DATE_TOTAL_PATTERN = [/Addebito in conto corrente il ([0-9]{2}\/[0-9]{2}\/[0-9]{4})/, '(c)', /^[0-9\.,]+$/]
IWBankEstrattoContoCartaReaderV1.TABLE_START_PATTERN = [
  "Data operazione",
  "Data registrazione",
  "Descrizione",
  "Importo in Euro",
  "Importo valuta originale"
];
IWBankEstrattoContoCartaReaderV1.RECORD_PATTERN = [
  /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data operazione
  /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/, // data registrazione
  /\S+/, // descrizione
  /^[0-9\.,\s]+$/, // importo in euro
  /^[0-9\.,\s]*$/ // importo in valuta originale
];



class IWPowerListaMovimentiReader {
  constructor(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  read(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then((rows) => {
      var reading = false;
      var document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_IWPOWER);

      for (let row of rows) {
        if (row.length < 5) {
          continue;
        }
        if (!row[0] || row[0].trim().length == 0) {
          continue;
        }
        if (row[0] === 'Estrazione Dal' && row[2] === 'Al') {
          document.date = moment(row[1], 'DD_MM_YYYY');
        }
        if (!reading
          && angular.equals(row, ["Data", "Valuta", "[#IMPORTO_IN]", "[#IMPORTO_OUT]", "Causale"])) {
          reading = true;
          continue;
        }
        if (!reading) {
          continue;
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
      }
      return document;
    });
  }
}
IWPowerListaMovimentiReader.$inject = ['ExcelReader', 'Movement', 'Document'];



/**
 * Reads an Estratto Conto (PDF) of Intesa Sanpaolo into a list of movements
 */
class IntesaEstrattoContoReader {
  constructor(PDFReader, Movement, Document) {
    this.PDFReader = PDFReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  /**
   * @param file
   * @returns {Promise|*}
   */
  read(file) {
    var self = IntesaEstrattoContoReader;
    var Movement = this.Movement;
    var Document = this.Document;

    var consecutiveSpaces = 0;
    var continuationConfig = {
      // breaks accumulation when two consecutive spaces are found
      consume: (string) => {
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
      apply: (record, accumulator) => {
        consecutiveSpaces = 0;
        accumulator = accumulator.filter((descr) => {
          return descr.trim().length > 0;
        });
        record[2] = [record[2]].concat(accumulator).join('\n');
        return record;
      }
    };

    return this.PDFReader.toStringArray(file).then((strings) => {
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
      var movements = records.map((record) => {
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
  }
}
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


class WidibaListaMovimentiReader {
  constructor(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  read(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    return this.ExcelReader.getFirstSheet(file).then((rows) => {
      var reading = false;
      let document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_WIDIBA);
      let DATE_REGEX = /^Da: ([0-9]{2}\/[0-9]{2}\/[0-9]{4}) - A: ([0-9]{2}\/[0-9]{2}\/[0-9]{4})$/;

      for (let row of rows) {
        if (row.length < 6) {
          continue;
        }
        if (!row[0] || row[0].trim().length == 0) {
          continue;
        }
        if (row[0] === 'IBAN') {
          let match = row[5].match(DATE_REGEX);
          document.date = moment(match[1], 'DD/MM/YYYY', 'it');
        }
        if (!reading
          && angular.equals(row, [
            "DATA CONT.", "DATA VAL.", "CAUSALE", "DESCRIZIONE", "", "IMPORTO(€)"])) {
          reading = true;
          continue;
        }
        if (!reading) {
          continue;
        }

        // read a record into a movement
        var movement = new Movement();
        movement.document = document;
        movement.bankId = null;
        movement.date = moment(excelDateToJSDate(row[0]));
        movement.executionDate = moment(excelDateToJSDate(row[1]));
        movement.description = row[2] + '\n' + row[3];
        movement.amount = parseFloat(row[5]);
        movement.direction = (movement.amount <= 0) ? Movement.DIRECTION_OUT : Movement.DIRECTION_IN;
        document.movements.push(movement);
      }
      return document;
    });
  }
}
WidibaListaMovimentiReader.$inject = ['ExcelReader', 'Movement', 'Document'];

class WidibaListaMovimentiCartaReader {
  constructor(ExcelReader, Movement, Document) {
    this.ExcelReader = ExcelReader;
    this.Movement = Movement;
    this.Document = Document;
  }

  read(file) {
    var Movement = this.Movement;
    var Document = this.Document;
    console.log(file);
    return this.ExcelReader.getFirstSheet(file).then((rows) => {
      var reading = false;
      let document = new Document(file, Document.TYPE_LISTA_MOVIMENTI_CARTA_WIDIBA);

      for (let row of rows) {
        console.log(row);

        if (row.length < 3) {
          continue;
        }
        if (!row[0] || row[0].trim().length == 0) {
          continue;
        }
        if (!reading
          && angular.equals(row, ["DATA OP.", "CAUSALE", "", "IMPORTO", "", "", "", "", ""])) {
          reading = true;
          continue;
        }
        if (!reading) {
          continue;
        }

        var date = row[0];
        if (date.indexOf('/') === -1) {
          date = moment(excelDateToJSDate(date));
        } else {
          date = moment(date, 'MM/DD/YY');
        }

        // read a record into a movement
        let movement = new Movement();
        movement.document = document;
        movement.bankId = null;
        movement.date = date;
        movement.executionDate = date;
        movement.description = row[1];
        movement.amount = parseFloat(row[3]);
        movement.direction = Movement.DIRECTION_OUT;
        document.movements.push(movement);
      }

      // Compute the document total, easier than reading from the excel.
      document.total = document.movements.reduce((total, item) => {
        return total + item.amount;
      }, 0);

      console.log('estratto conto carta: ', document);
      return document;
    });
  }
}
WidibaListaMovimentiCartaReader.$inject = ['ExcelReader', 'Movement', 'Document'];

var Reader = angular.module('Desmond.Reader', []);
Reader.service('PDFReader', PDFReader);
Reader.service('ExcelReader', ExcelReader);
Reader.service('IWBankEstrattoContoReader', IWBankEstrattoContoReader);
Reader.service('IWBankListaMovimentiReader', IWBankListaMovimentiReader);
Reader.service('IWPowerListaMovimentiReader', IWPowerListaMovimentiReader);
Reader.service('BNLListaMovimentiReader', BNLListaMovimentiReader);
Reader.service('IntesaEstrattoContoReader', IntesaEstrattoContoReader);
Reader.service('WidibaListaMovimentiReader', WidibaListaMovimentiReader);

Reader.service('IWBankCartaReplaceHandler', IWBankCartaReplaceHandler);
Reader.service('IWBankEstrattoContoCartaReaderV1', IWBankEstrattoContoCartaReaderV1);
Reader.service('IWBankEstrattoContoCartaReaderV2', IWBankEstrattoContoCartaReaderV2);
Reader.service('IWBankEstrattoContoCartaReader', IWBankEstrattoContoCartaReader);

Reader.service('WidibaCartaReplaceHandler', WidibaCartaReplaceHandler);
Reader.service('WidibaListaMovimentiCartaReader', WidibaListaMovimentiCartaReader);
