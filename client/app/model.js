(function($, angular) {

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
  var Document = function(file, documentType, date, total, movements, metadata) {
    this.hash = file.hash;
    this.filename = file.name;
    this.mimeType = file.type || this.guessMimeType(file.name);
    this.documentType = documentType;
    this.date = date || moment;
    this.total = total || 0;
    this.movements = movements || [];
    this.metadata = metadata || {};

    var doc = this;
    this.movements.forEach(function(movement) {
      movement.document = doc;
    });
  };

  Document.prototype.guessMimeType = function(filename) {
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
  };

  Document.TYPE_ESTRATTO_CONTO_IWBANK = 'EstrattoContoIWBank';
  Document.TYPE_LISTA_MOVIMENTI_IWBANK = 'ListaMovimentiIWBank';
  Document.TYPE_ESTRATTO_CONTO_CARTA_IW = 'EstrattoContoCartaIW';
  Document.TYPE_LISTA_MOVIMENTI_BNL = 'ListaMovimentiBNL';
  Document.TYPE_LISTA_MOVIMENTI_IWPOWER = 'ListaMovimentiIWPower';


  var Movement = function() {
    this.date = moment();
    this.executionDate = moment();
    this.bankId = null;
    this.description = null;
    this.direction = null;
    this.amount = 0;
    this.deleted = false;

    // links
    this.document = null; // document from which the movement has been imported
    this.account = null;
    this.category = null;
    this.source = null;
    this.sourceMovement = null; // link to the inverse movement in the source account
    this.destination = null;
    this.destinationMovement = null; // link to the inverse movement in the destination account
  };
  Movement.DIRECTION_IN = 'in';
  Movement.DIRECTION_OUT = 'out';

  var CategoriesRepository = function($timeout, Restangular) {
    this.Restangular = Restangular;
    this.all = [];

    var repo = this;
    this.loaded = $timeout(function() {
      return repo.load();
    });
  };
  CategoriesRepository.$inject = ['$timeout', 'Restangular'];
  CategoriesRepository.prototype.load = function() {
    var repo = this;
    this.Restangular.all('categories').getList({sort_by: 'name'}).then(function(categories) {
      repo.all = categories;
    });
  };
  CategoriesRepository.prototype.find = function(id) {
    return _.find(this.all, {_id: id});
  };
  CategoriesRepository.prototype.add = function(category) {
     var repo = this;
     return this.Restangular.all('categories').post(category).then(function(result) {
       return repo.Restangular.one('categories', result._id).get();
     }).then(function(newCategory) {
       repo.all = _.sortBy([newCategory].concat(repo.all), 'name');
       return newCategory;
     });
   };




  var AccountsRepository = function($timeout, Restangular) {
    this.Restangular = Restangular;

    this.bankAccounts = [];
    this.people = [];
    this.all = [];
    this.moneyAccount = {
      _id: 'money',
      name: 'Contanti',
      avatarUrl: 'images/money.jpg'
    };

    var repo = this;
    this.loaded = $timeout(function() {
      return repo.load();
    });
  };
  AccountsRepository.$inject = ['$timeout', 'Restangular'];
  AccountsRepository.prototype.load = function(name) {
    var repo = this;
    return this.Restangular.all('accounts').getList().then(function(accounts) {
      repo.all = accounts;
      _.each(accounts, function(account) {
        if ('bank_account' === account.type) {
          repo.bankAccounts.push(account);
        } else if ('person' === account.type) {
          repo.people.push(account);
        }
      });
    });
  };
  AccountsRepository.prototype.findByName = function(name) {
    return _.find(this.all, {name: name});
  };
  AccountsRepository.prototype.find = function(id) {
    return _.find(this.all, {'_id': id});
  };




  var DocumentsRepository = function($timeout, Restangular) {
    this.Restangular = Restangular;
    this.endpoint = Restangular.all('documents');
    this.all = [];

    var repo = this;
    this.loaded = $timeout(function() {
      return repo.load();
    });
  };
  DocumentsRepository.$inject = ['$timeout', 'Restangular'];
  DocumentsRepository.prototype.load = function(name) {
    var repo = this;
    return this.endpoint.getList().then(function(documents) {
      repo.all = documents;
    });
  };
  DocumentsRepository.prototype.findByHash = function(hash) {
    return _.find(this.all, {hash: hash});
  };
  DocumentsRepository.prototype.find = function(id) {
    return _.find(this.all, {'_id': id});
  };
  DocumentsRepository.prototype.add = function(document) {
    var repo = this;
    var endpoint = this.endpoint;
    return endpoint.post(document).then(function(result) {
      return repo.Restangular.one('documents', result._id).get();
    }).then(function(newDocument) {
      repo.all = [].concat(repo.all, [newDocument]);
      return newDocument;
    });
  };




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
  var MovementsRepository = function($q, Restangular, DocumentsRepository, CategoriesRepository, AccountsRepository) {
    this.Restangular = Restangular;
    this.$q = $q;
    this.all = [];
    this.movementsEndpoint = Restangular.all('movements');

    // load movements only after accounts and categories
    var repo = this;
    this.loaded = $q.all([DocumentsRepository.loaded, CategoriesRepository.loaded, AccountsRepository.loaded]).then(function() {
      repo.movementsEndpoint.getList({pagesize: 1000, filter: {deleted: false}}).then(function(movements) {
        repo.all = _.sortBy(movements, function(movement) {
          return movement.date.toISOString();
        });
      });
    });
  };
  MovementsRepository.$inject = ['$q', 'Restangular', 'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository'];

  /**
   * Append to movements
   *
   * @param movements
   */
  MovementsRepository.prototype.add = function(movements) {
    if (!_.isArray(movements)) {
      movements = [movements];
    }
    var repo = this;
    var movementsEndpoint = this.movementsEndpoint;
    var promises = _.map(movements, function(movement) {
      return movementsEndpoint.post(movement);
    });
    return this.$q.all(promises).then(function(results) {
      return _.pluck(results, '_id');
    }).then(function(newIds) {
      return movementsEndpoint.getList({pagesize: 1000, filter: {_id: {$in: newIds}}});
    }).then(function(newMovements) {
      repo.all = _.sortBy([].concat(repo.all, newMovements), function(movement) {
        return movement.date.toISOString();
      });
    });
  };

  /**
   * Remove the specified movement from the list, and marks it as deleted in the database.
   *
   * @param movement
   * @return {Promise}
   */
  MovementsRepository.prototype.remove = function(movement) {
    var repo = this;

    movement.deleted = true;
    return movement.save().then(function() {
      repo.all = _.filter(repo.all, function(mv) {
        return (mv !== movement);
      });
    });
  };

  /**
   * Saves the specified movement remotely and on success reloads it from the server and places it in the list.
   *
   * @param movement
   * @return {Promise}
   */
  MovementsRepository.prototype.save = function(movement) {
    var repo = this;
    return movement.save().then(function(result) {
      if (!result || !result._id) {
        return repo.Restangular.one('movements', movement._id).get();
      } else {
        return result;
      }
    }).then(function(newMovement) {
      var index = _.indexOf(_.pluck(repo.all, '_id'), movement._id);
      repo.all.splice(index, 1, newMovement);
      repo.all = [].concat(repo.all);
      return newMovement;
    });
  };




  var Model = angular.module('Desmond.Model', ['restangular']);

  Model.run(['Restangular', 'DocumentsRepository', 'CategoriesRepository', 'AccountsRepository', function(Restangular, DocumentsRepository, CategoriesRepository, AccountsRepository) {

    var LINK_FIELDS = ['document', 'account', 'category', 'source', 'sourceMovement', 'destination', 'destinationMovement'];

    // serialize movement and document
    Restangular.addRequestInterceptor(function(element, operation, what, url) {
      if (what === 'movements' && (operation === 'post' || operation === 'put' || operation === 'patch')) {
        var movement = angular.copy(element);
        movement.date = movement.date.format();
        movement.executionDate = movement.executionDate.format();
        _.each(LINK_FIELDS, function (fieldName) {
          if (movement[fieldName]) {
            movement[fieldName] = movement[fieldName]._id;
          }
        });
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
    Restangular.addElementTransformer('movements', false, function(movement) {
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
      // TODO: add sourceMovement and destinationMovement
      return movement;
    });

    // unserialize document
    Restangular.addElementTransformer('documents', false, function(document) {
      document.date = moment(document.date);
      // movements gets filled in documents when they are loaded, the ids stored in the database are just for reference
      document.movements = [];
      return document;
    });

  }]);

  // models
  Model.factory('Movement', function() { return Movement; });
  Model.factory('Document', function() { return Document; });

  // repositories
  Model.service('CategoriesRepository', CategoriesRepository);
  Model.service('AccountsRepository', AccountsRepository);
  Model.service('DocumentsRepository', DocumentsRepository);
  Model.service('MovementsRepository', MovementsRepository);

})(window.jQuery, window.angular);