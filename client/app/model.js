(function($, angular) {

  var Movement = function() {
    this.accountId = null;
    this.date = moment();
    this.executionDate = moment();
    this.bankId = null;
    this.description = null;
    this.amount = 0;
    this.category = null;

    this.direction = null;
    // source of this movement (account?)
    this.source = null;
    // destination of this movement (account?)
    this.destination = null;
  };
  Movement.DIRECTION_IN = 'in';
  Movement.DIRECTION_OUT = 'out';

  var CategoriesRepository = function(Restangular) {
    this.all = [];

    var repo = this;
    Restangular.all('categories').getList({sort_by: 'name'}).then(function(categories) {
      // index categories by id
      var catById = {};
      _.each(categories, function(category) {
        catById[category._id] = category;
      });
      repo.all = catById;
    });
  };
  CategoriesRepository.$inject = ['Restangular'];

  var AccountsRepository = function(Restangular) {
    this.all = null;

    var repo = this;
    Restangular.all('accounts').getList().then(function(accounts) {
      repo.all = accounts;
    });
  };
  AccountsRepository.$inject = ['Restangular'];
  AccountsRepository.prototype.findByName = function(name) {
    return _.find(this.all, {name: name});
  };

  var Model = angular.module('Desmond.Model', ['restangular']);
  Model.factory('Movement', function() { return Movement; });
  Model.service('CategoriesRepository', CategoriesRepository);
  Model.service('AccountsRepository', AccountsRepository);

})(window.jQuery, window.angular);