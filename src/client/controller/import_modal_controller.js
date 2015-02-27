class ImportModalController {
  constructor($timeout, $modalInstance, document) {
    document.movements.forEach((movement, index) => {
      movement._id = index;
    });

    this.$modalInstance = $modalInstance;
    this.movements = document.movements;
    $timeout(() => {
      this.selectedItems = [].concat(document.movements);
    });
  }

  ok() {
    this.selectedItems.forEach((movement) => {
      delete movement._id;
    });
    this.$modalInstance.close(this.selectedItems);
  }
}

ImportModalController.$inject = ['$timeout', '$modalInstance', 'document'];

export default ImportModalController;
