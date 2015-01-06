(function($, angular) {

  var Movement = function() {
    this.date = moment();
    this.executionDate = moment();
    this.bankId = null;
    this.description = null;
    this.direction = null;
    this.amount = 0;
    this.deleted = false;

    // links
    this.account = null;
    this.category = null;
    this.source = null;
    this.sourceMovement = null; // link to the inverse movement in the source account
    this.destination = null;
    this.destinationMovement = null; // link to the inverse movement in the destination account
  };
  Movement.DIRECTION_IN = 'in';
  Movement.DIRECTION_OUT = 'out';

  var CategoriesRepository = function(Restangular) {
    this.all = [];

    var repo = this;
    this.loaded = Restangular.all('categories').getList({sort_by: 'name'}).then(function(categories) {
      // index categories by id
      var catById = {};
      _.each(categories, function(category) {
        catById[category._id] = category;
      });
      repo.all = catById;
    });
  };
  CategoriesRepository.$inject = ['Restangular'];
  CategoriesRepository.prototype.find = function(id) {
    return _.find(this.all, {_id: id});
  };

  var AccountsRepository = function(Restangular) {
    this.bankAccounts = [];
    this.people = [];
    this.all = [];
    this.moneyAccount = {
      _id: 'money',
      name: 'Contanti',
      avatarUrl: 'images/money.jpg'
    };

    var repo = this;
    this.loaded = Restangular.all('accounts').getList().then(function(accounts) {
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
  AccountsRepository.$inject = ['Restangular'];
  AccountsRepository.prototype.findByName = function(name) {
    return _.find(this.all, {name: name});
  };
  AccountsRepository.prototype.find = function(id) {
    return _.find(this.all, {'_id': id});
  };

  /**
   * Stores the list of all movements, sorted by date ASC.
   * Retrieves the list on creation, can be updated via "add" and "remove".
   *
   * @param $q
   * @param Restangular
   * @param CategoriesRepository
   * @param AccountsRepository
   * @constructor
   */
  var MovementsRepository = function($q, Restangular, CategoriesRepository, AccountsRepository) {
    this.$q = $q;
    this.all = [];
    this.movementsEndpoint = Restangular.all('movements');

    // load movements only after accounts and categories
    var repo = this;
    this.loaded = $q.all([CategoriesRepository.loaded, AccountsRepository.loaded]).then(function() {
      repo.movementsEndpoint.getList({pagesize: 1000, filter: {deleted: false}}).then(function(movements) {
        repo.all = _.sortBy(movements, function(movement) {
          return movement.date.toISOString();
        });
      });
    });
  };
  MovementsRepository.$inject = ['$q', 'Restangular', 'CategoriesRepository', 'AccountsRepository'];

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
    this.$q.all(promises).then(function(results) {
      console.log("POST results", results);
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
   * Remove the specified
   *
   * @param movement
   */
  MovementsRepository.prototype.remove = function(movement) {
  };

  var Model = angular.module('Desmond.Model', ['restangular']);

  Model.run(['Restangular', 'CategoriesRepository', 'AccountsRepository', function(Restangular, CategoriesRepository, AccountsRepository) {

    var LINK_FIELDS = ['account', 'category', 'source', 'sourceMovement', 'destination', 'destinationMovement'];

    // serialize
    Restangular.addRequestInterceptor(function(element, operation, what, url) {
      if (what === 'movements' && (operation === 'post' || operation === 'put' || operation === 'patch')) {
        var copy = angular.copy(element);
        copy.date = copy.date.format();
        copy.executionDate = copy.executionDate.format();
        _.each(LINK_FIELDS, function(fieldName) {
          if (copy[fieldName]) {
            copy[fieldName] = copy[fieldName]._id;
          }
        });
        return copy;
      } else {
        return element;
      }
    });

    // unserialize
    Restangular.addElementTransformer('movements', false, function(movement) {
      movement.date = moment(movement.date);
      movement.executionDate = moment(movement.executionDate);
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
      //console.log(movement);
      // TODO: add sourceMovement and destinationMovement
      return movement;
    });


  }]);

  Model.factory('Movement', function() { return Movement; });
  Model.service('CategoriesRepository', CategoriesRepository);
  Model.service('AccountsRepository', AccountsRepository);
  Model.service('MovementsRepository', MovementsRepository);

})(window.jQuery, window.angular);