(function($, angular) {

  var Movement = function() {
    this.accountId = null;
    this.date = moment();
    this.bankId = null;
    this.description = null;
    this.amount = 0;
    this.categoryId = null;
    this.category = null;
  };

  var CategoriesRepository = function(Restangular) {
    this.all = null;

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

  var Model = angular.module('Desmond.Model', ['restangular']);
  Model.factory('Movement', function() { return Movement; });
  Model.service('CategoriesRepository', CategoriesRepository);

})(window.jQuery, window.angular);