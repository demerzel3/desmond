  var ImportModalController = function($timeout, $modalInstance, document) {
    _.each(document.movements, function(movement, index) {
      movement._id = index;
    });

    //console.log(document);

    this.$modalInstance = $modalInstance;
    this.movements = document.movements;
    var ctrl = this;
    $timeout(function() {
      ctrl.selectedItems = [].concat(document.movements);
    });
  };
  ImportModalController.$inject = ['$timeout', '$modalInstance', 'document'];

  ImportModalController.prototype.ok = function() {
    _.each(this.selectedItems, function(movement) {
      delete movement._id;
    });
    this.$modalInstance.close(this.selectedItems);
  };

  export default ImportModalController;
