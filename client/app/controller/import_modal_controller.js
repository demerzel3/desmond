(function($, angular) {

  var ImportModalController = function($timeout, $modalInstance, movements) {
    _.each(movements, function(movement, index) {
      movement._id = index;
    });

    this.$modalInstance = $modalInstance;
    this.movements = movements;
    var ctrl = this;
    $timeout(function() {
      ctrl.selectedItems = [].concat(movements);
    });
  };
  ImportModalController.$inject = ['$timeout', '$modalInstance', 'movements'];

  ImportModalController.prototype.ok = function() {
    _.each(this.selectedItems, function(movement) {
      delete movement._id;
    });
    this.$modalInstance.close(this.selectedItems);
  };

  angular.module('Desmond').controller('ImportModalController', ImportModalController);

})(window.jQuery, window.angular);