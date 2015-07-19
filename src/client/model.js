/**
 * Represents an imported document, that is probably a file.
 * Three key pieces of information are coded as properties here:
 *  - document type (e.g. the source of this document)
 *  - date of the document
 *  - total amount of the document
 * Everything else can be freely stored in 'metadata'.
 *
 * @param file {File} contains name, type and hash
 * @param documentType
 * @param date
 * @param total
 * @param movements
 * @param metadata could be anything
 * @constructor
 */
class Document {
  constructor(file, documentType, date, total, movements, metadata) {
    this.hash = file.hash;
    this.filename = file.name;
    this.mimeType = file.type || this.guessMimeType(file.name);
    this.documentType = documentType;
    this.date = date || moment;
    this.total = total || 0;
    this.movements = movements || [];
    this.metadata = metadata || {};

    for (let movement of this.movements) {
      movement.document = this;
    }
  }

  guessMimeType(filename) {
    var chunks = filename.split('.');
    if (chunks.length < 2) {
      return null;
    }
    var ext = chunks[chunks.length-1].toLowerCase();
    if ('pdf' === ext) {
      return 'application/pdf';
    } else if ('xls' === ext) {
      return 'application/vnd.ms-excel';
    } else {
      return null;
    }
  }
}
Document.TYPE_ESTRATTO_CONTO_IWBANK = 'EstrattoContoIWBank';
Document.TYPE_LISTA_MOVIMENTI_IWBANK = 'ListaMovimentiIWBank';
Document.TYPE_ESTRATTO_CONTO_CARTA_IW = 'EstrattoContoCartaIW';
Document.TYPE_LISTA_MOVIMENTI_BNL = 'ListaMovimentiBNL';
Document.TYPE_LISTA_MOVIMENTI_IWPOWER = 'ListaMovimentiIWPower';
Document.TYPE_ESTRATTO_CONTO_INTESA = 'EstrattoContoIntesa';


class Movement {
  constructor() {
    this.date = moment();
    this.executionDate = moment();
    this.bankId = null;
    this.description = null;
    this.direction = null;
    this.amount = 0;
    this.deleted = false;
    this.originatedBy = null;
    this.replaceHandler = null;

    // links
    this.document = null; // document from which the movement has been imported
    this.account = null;
    this.category = null;
    this.source = null;
    this.sourceMovement = null; // link to the inverse movement in the source account
    this.destination = null;
    this.destinationMovement = null; // link to the inverse movement in the destination account
    this.originatedFrom = null;
  }
}
Movement.DIRECTION_IN = 'in';
Movement.DIRECTION_OUT = 'out';
Movement.ORIGINATED_BY_MERGE = 'merge';
Movement.ORIGINATED_BY_INVERSION = 'inversion';

class CategoriesRepository {
  constructor($timeout, Restangular, RuntimeConfiguration) {
    this.Restangular = Restangular;
    this.all = [];

    this.loaded = RuntimeConfiguration.get().then(() => {
      return $timeout(() => {
        return this.load();
      });
    });
  }

  load() {
    return this.Restangular.all('categories').getList({sort_by: 'name'}).then((categories) => {
      this.all = categories;
    });
  }

  find(id) {
    return _.find(this.all, {_id: id});
  }

  add(category) {
    return this.Restangular.all('categories').post(category).then((result) => {
      return this.Restangular.one('categories', result._id).get();
    }).then((newCategory) => {
      this.all = _.sortBy([newCategory].concat(this.all), 'name');
      return newCategory;
    });
  }
}
CategoriesRepository.$inject = ['$timeout', 'Restangular', 'RuntimeConfiguration'];



class AccountsRepository {
  constructor($timeout, Restangular, RuntimeConfiguration) {
    this.Restangular = Restangular;

    this.bankAccounts = [];
    this.people = [];
    this.all = [];
    this.moneyAccount = {
      _id: 'money',
      name: 'Contanti',
      avatarUrl: 'images/money.jpg'
    };

    this.loaded = RuntimeConfiguration.get().then(() => {
      return $timeout(() => {
        return this.load();
      });
    });
  }

  load() {
    return this.Restangular.all('accounts').getList().then((accounts) => {
      this.all = accounts;
      this.bankAccounts = [];
      this.people = [];
      for (let account of accounts) {
        if ('bank_account' === account.type) {
          this.bankAccounts.push(account);
        } else if ('person' === account.type) {
          this.people.push(account);
        }
      }
    });
  }

  findByName(name) {
    return _.find(this.all, {name: name});
  }

  find(id) {
    return _.find(this.all, {'_id': id});
  }
}
AccountsRepository.$inject = ['$timeout', 'Restangular', 'RuntimeConfiguration'];


class DocumentsRepository {
  constructor($timeout, Restangular, RuntimeConfiguration) {
    this.Restangular = Restangular;
    this.endpoint = Restangular.all('documents');
    this.all = [];

    this.loaded = RuntimeConfiguration.get().then(() => {
      return $timeout(() => {
        return this.load();
      });
    });
  }

  load(name) {
    return this.endpoint.getList().then((documents) => {
      this.all = documents;
    });
  }

  findByHash(hash) {
    return _.find(this.all, {hash: hash});
  }

  find(id) {
    return _.find(this.all, {'_id': id});
  }

  add(document) {
    return this.endpoint.post(document).then((result) => {
      return this.Restangular.one('documents', result._id).get();
    }).then((newDocument) => {
      this.all = [].concat(this.all, [newDocument]);
      return newDocument;
    });
  }
}
DocumentsRepository.$inject = ['$timeout', 'Restangular', 'RuntimeConfiguration'];



/**
 * Stores the list of all movements, sorted by date ASC.
 * Retrieves the list on creation, can be updated via "add" and "remove".
 *
 * @param $q
 * @param Restangular
 * @param DocumentsRepository
 * @param CategoriesRepository
 * @param AccountsRepository
 * @constructor
 */
class MovementsRepository {
  constructor($q, Restangular, DocumentsRepository, CategoriesRepository, AccountsRepository) {
    this.Restangular = Restangular;
    this.$q = $q;
    this.all = [];
    this.movementsEndpoint = Restangular.all('movements');

    // load movements only after documents, accounts and categories
    this.loaded = $q.all([DocumentsRepository.loaded, CategoriesRepository.loaded, AccountsRepository.loaded]).then(() => {
      this.movementsEndpoint.getList({pagesize: 1000, filter: {deleted: false}}).then((movements) => {
        this.all = _.sortBy(movements, (movement) => {
          return movement.date.toISOString();
        });
      });
    });
  }

  find(id) {
    return _.find(this.all, {'_id': id});
  }

  /**
   * Append to movements
   *
   * @param movements
   */
  add(movements) {
    if (!_.isArray(movements)) {
      movements = [movements];
    }
    var movementsEndpoint = this.movementsEndpoint;
    var promises = movements.map((movement) => {
      return movementsEndpoint.post(movement);
    });
    return this.$q.all(promises).then((results) => {
      return _.pluck(results, '_id');
    }).then((newIds) => {
      return movementsEndpoint.getList({pagesize: 1000, filter: {_id: {$in: newIds}}});
    }).then((newMovements) => {
      this.all = _.sortBy([].concat(this.all, newMovements), (movement) => {
        return movement.date.toISOString();
      });
    });
  }

  /**
   * Remove the specified movement from the list, and marks it as deleted in the database.
   *
   * @param movement
   * @return {Promise}
   */
  remove(movement) {
    movement.deleted = true;
    return movement.save().then(() => {
      this.all = this.all.filter((mv) => (mv !== movement));
    });
  }

  /**
   * Saves the specified movement remotely and on success reloads it from the server and places it in the list.
   *
   * @param movement
   * @return {Promise}
   */
  save(movement) {
    return movement.save().then((result) => {
      if (!result || !result._id) {
        return this.Restangular.one('movements', movement._id).get();
      } else {
        return result;
      }
    }).then((newMovement) => {
      var index = _.indexOf(_.pluck(this.all, '_id'), movement._id);
      this.all.splice(index, 1, newMovement);
      this.all = [].concat(this.all);
      return newMovement;
    });
  }

  /**
   * Returns a list of movements with unassigned category
   */
  findOutgoingUnassignedCategory() {
    return this.all.filter((movement) => {
      return movement.direction === 'out'
        && !movement.replaceHandler
        && (!movement.destination || 'bank_account' !== movement.destination.type)
        && movement.category === null;
    });
  }

  /**
   * Create a Movement equivalent to the current one but with inverted direction and amount.
   * @return {Movement}
   */
  createInverse(source) {
    let inverse = new Movement();
    inverse.date = source.date;
    inverse.executionDate = source.executionDate;
    inverse.bankId = source.bankId;
    inverse.description = 'Inverso di: \n' + source.description;
    inverse.amount = -source.amount;
    if (source.direction === Movement.DIRECTION_IN) {
      inverse.direction = Movement.DIRECTION_OUT;
      inverse.account = source.source;
      inverse.destination = source.account;
    } else {
      inverse.direction = Movement.DIRECTION_IN;
      inverse.account = source.destination;
      inverse.source = source.account;
    }
    inverse.category = source.category;

    inverse.originatedBy = Movement.ORIGINATED_BY_INVERSION;
    inverse.originatedFrom = [source];

    return inverse;
  }
}
MovementsRepository.$inject = ['$q', 'Restangular', 'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository'];



var Model = angular.module('Desmond.Model', ['restangular', 'Desmond.Configuration']);

Model.run(['$injector', '$timeout', '$q', 'Restangular', 'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository', 'MovementsRepository',
  function($injector, $timeout, $q, Restangular, DocumentsRepository, CategoriesRepository, AccountsRepository, MovementsRepository) {

    const LINK_FIELDS = ['document', 'account', 'category', 'source', 'sourceMovement', 'destination', 'destinationMovement'];

    // serialize movement and document
    Restangular.addRequestInterceptor((element, operation, what, url) => {
      if (what === 'movements' && (operation === 'post' || operation === 'put' || operation === 'patch')) {
        var movement = angular.copy(element);
        movement.date = movement.date.format();
        movement.executionDate = movement.executionDate.format();
        if (movement.replaceHandler) {
          movement.replaceHandler = movement.replaceHandler.toString();
        }
        for (let fieldName of LINK_FIELDS) {
          if (movement[fieldName]) {
            movement[fieldName] = movement[fieldName]._id;
          }
        }
        if (movement.originatedFrom) {
          movement.originatedFrom = _.pluck(movement.originatedFrom, '_id');
        }
        return movement;
      } else if (what === 'documents' && (operation === 'post' || operation === 'put' || operation === 'patch')) {
        var document = angular.copy(element);
        document.date = document.date.format();
        // the relation is tracked from the movements side
        delete document.movements;
        return document;
      } else {
        return element;
      }
    });

    // unserialize movement
    Restangular.addElementTransformer('movements', false, (movement) => {
      movement.date = moment(movement.date);
      movement.executionDate = moment(movement.executionDate);
      if (movement.document) {
        movement.document = DocumentsRepository.find(movement.document);
        if (movement.document) {
          movement.document.movements.push(movement);
        }
      }
      if (movement.account) {
        movement.account = AccountsRepository.find(movement.account);
      }
      if (movement.category) {
        movement.category = CategoriesRepository.find(movement.category);
      }
      if (movement.source) {
        if (movement.source === 'money') {
          movement.source = AccountsRepository.moneyAccount;
        } else {
          movement.source = AccountsRepository.find(movement.source);
        }
      }
      if (movement.destination) {
        movement.destination = AccountsRepository.find(movement.destination);
      }
      // originatedFrom is an array of reference to deleted movements, must be loaded independently
      if (movement.originatedFrom) {
        $q.all(movement.originatedFrom.map((movementId) => {
          return Restangular.one('movements', movementId).get();
        })).then((linkedMovements) => {
          movement.originatedFrom = linkedMovements;
        });
      }
      if (_.isString(movement.replaceHandler)) {
        movement.replaceHandler = $injector.get(movement.replaceHandler);
      }
      // TODO: add sourceMovement and destinationMovement
      return movement;
    });

    // unserialize document
    Restangular.addElementTransformer('documents', false, (document) => {
      document.date = moment(document.date);
      // movements gets filled in documents when they are loaded, the ids stored in the database are just for reference
      document.movements = [];
      return document;
    });

  }]);

// models
Model.factory('Movement', () => Movement);
Model.factory('Document', () => Document);

// repositories
Model.service('CategoriesRepository', CategoriesRepository);
Model.service('AccountsRepository', AccountsRepository);
Model.service('DocumentsRepository', DocumentsRepository);
Model.service('MovementsRepository', MovementsRepository);
