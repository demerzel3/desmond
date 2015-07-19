class EditModalController {
  constructor($timeout, $modalInstance, AccountsRepository, CategoriesRepository, movement) {
    this.accounts = _.sortBy([AccountsRepository.moneyAccount].concat(AccountsRepository.all), 'name');
    this.categories = [].concat(CategoriesRepository.all, [{
      name: '+ Nuova categoria',
      _id: '_custom'
    }]);

    this.$modalInstance = $modalInstance;
    this.movement = movement;
    this.customCategoryName = null;
    this.title = '';

    if (movement._id) {
      this.title = 'Modifica movimento';
    } else if (movement.originatedBy) {
      if ('merge' === movement.originatedBy) {
        this.title = 'Unisci movimenti';
      } else if ('inversion' === movement.originatedBy) {
        this.title = 'Movimento inverso'
      }
    } else {
      this.title = 'Nuovo movimento';
    }
  }

  getDocumentIconClass(document) {
    if ('application/pdf' === document.mimeType) {
      return 'fa-file-pdf-o';
    } else if ('application/vnd.ms-excel' === document.mimeType) {
      return 'fa-file-excel-o';
    } else {
      return 'fa-file-o';
    }
  }

  cancel() {
    this.$modalInstance.dismiss();
  }

  ok() {
    if (this.movement.category && this.movement.category._id == '_custom') {
      this.movement.category = {
        name: this.customCategoryName,
        _isNew: true
      };
    }
    this.$modalInstance.close(this.movement);
  }
}
EditModalController.$inject = ['$timeout', '$modalInstance', 'AccountsRepository', 'CategoriesRepository', 'movement'];

export default EditModalController;