(function($, angular) {

  var EditModalController = function($timeout, $modalInstance, AccountsRepository, CategoriesRepository, movement) {
    this.accounts = AccountsRepository;
    this.categories = [];
    var ctrl = this;
    _.forIn(CategoriesRepository.all, function(category) {
      ctrl.categories.push(category);
    });
    this.categories.push({
      name: '+ Nuova categoria',
      _id: '_custom'
    });

    this.$modalInstance = $modalInstance;
    this.movement = movement;
    this.customCategoryName = null;
  };
  EditModalController.$inject = ['$timeout', '$modalInstance', 'AccountsRepository', 'CategoriesRepository', 'movement'];

  EditModalController.prototype.getDocumentIconClass = function(document) {
    if ('application/pdf' === document.mimeType) {
      return 'fa-file-pdf-o';
    } else if ('application/vnd.ms-excel' === document.mimeType) {
      return 'fa-file-excel-o';
    } else {
      return 'fa-file-o';
    }
  };

  EditModalController.prototype.cancel = function() {
    this.$modalInstance.dismiss();
  };

  EditModalController.prototype.ok = function() {
    if (this.movement.category._id == '_custom') {
      this.movement.category = {
        name: this.customCategoryName,
        _isNew: true
      };
    }
    this.$modalInstance.close(this.movement);
  };

  angular.module('Desmond').controller('EditModalController', EditModalController);

})(window.jQuery, window.angular);