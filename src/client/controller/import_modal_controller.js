class ImportModalController {
  constructor($timeout, $modalInstance, document) {
    _.each(document.movements, function(movement, index) {
      movement._id = index;
    });

    this.$modalInstance = $modalInstance;
    this.movements = document.movements;
    $timeout(() => {
      this.selectedItems = [].concat(document.movements);
    });
  }

  ok() {
    _.each(this.selectedItems, function(movement) {
      delete movement._id;
    });
    this.$modalInstance.close(this.selectedItems);
  }
}

ImportModalController.$inject = ['$timeout', '$modalInstance', 'document'];

export default ImportModalController;
