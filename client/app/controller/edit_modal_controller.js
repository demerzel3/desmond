(function($, angular) {

  var EditModalController = function($timeout, $modalInstance, AccountsRepository, CategoriesRepository, movement) {
    this.accounts = AccountsRepository;
    this.categories = CategoriesRepository;

    this.$modalInstance = $modalInstance;
    this.movement = movement;

    _.forIn(this.categories.all, function(category) {
      if (category === movement.category) {
        console.log("category found! OMG!");
      }
    });
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
    this.$modalInstance.close(this.movement);
  };

  angular.module('Desmond').controller('EditModalController', EditModalController);

})(window.jQuery, window.angular);