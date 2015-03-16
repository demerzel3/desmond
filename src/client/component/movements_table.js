class DesmondMovementsTableController {
  constructor($scope, $element, $attrs) {
    this.$element = $element;
    this.selectedItems = [];
    this.selectedItemsMap = {};

    // update selection map on change of selection
    $scope.$watch('ctrl.selectedItems', (selectedItems, oldSelectedItems) => {
      if (selectedItems === oldSelectedItems) {
        return;
      }
      // build a map from the list of selected items
      var map = {};
      for (let selectedItem of selectedItems) {
        map[selectedItem._id] = true;
      }
      this.selectedItemsMap = map;
    });
    // update selection on change of base collection (does not mantain selection of invisible items)
    $scope.$watch('ctrl.movements', (movements, oldMovements) => {
      if (movements === oldMovements) {
        return;
      }
      var newMovementsIds = _.invert(_.pluck(movements, '_id'));
      // this in turn will update the selection map
      this.selectedItems = this.selectedItems.filter((movement) => {
        return !_.isUndefined(newMovementsIds[movement._id]);
      });
    });

    if (!_.isUndefined($attrs.fixedHeader)) {
      // adapt headers
      let adaptHeader = _.debounce(() => {
        this.adaptHeader();
      }, 100);
      $element.resize(adaptHeader);
      $scope.$on('$destroy', function () {
        $element.removeResize(adaptHeader);
      });
    }
  }

  deselectItem(item) {
    this.selectedItemsMap[item._id] = false;
    var index = _.indexOf(this.selectedItems, item);
    this.selectedItems.splice(index, 1);
  };

  selectItem(item) {
    this.selectedItemsMap[item._id] = true;
    this.selectedItems.push(item);
  };

  toggleAllSelection() {
    if (this.selectedItems.length < this.movements.length) {
      this.selectedItems = [].concat(this.movements);
    } else {
      this.selectedItems = [];
    }
  };

  toggleSelection(item) {
    if (this.isSelected(item)) {
      this.deselectItem(item);
    } else {
      this.selectItem(item);
    }
  };

  selectAll() {
    this.selectedItems = [].concat(this.movements);
  };

  deselectAll() {
    this.selectedItems = [];
    this.selectedItemsMap = {};
  };

  isSelected(item) {
    return this.selectedItemsMap[item._id];
  };

  adaptHeader() {
    var heads = this.$element.find('thead > tr > th');
    var cols = this.$element.find('tbody > tr:first-child > td');
    if (cols.length == 0) {
      return;
    }
    if (heads.length !== cols.length) {
      return;
    }
    heads.each((index, head) => {
      $(head).width(cols.eq(index).width());
    });
  }
}
DesmondMovementsTableController.$inject = ['$scope', '$element', '$attrs'];

export default () => {
  return {
    restrict: 'E',
    templateUrl: 'components/movements_table.html',
    scope: {
      movements: '=',

      selectionEnabled: '@',
      selectedItems: '=?', // can be omitted

      replaceMovementEnabled: '@',
      onReplaceMovement: '&',

      editEnabled: '@',
      onEdit: '&',

      inlineCategoryEditEnabled: '@',
      categories: '=?'
    },
    controller: DesmondMovementsTableController,
    controllerAs: 'ctrl',
    bindToController: true,
    compile: function(element, attrs) {
      // set default values to attributes
      if (!attrs.replaceMovementEnabled) {
        attrs.replaceMovementEnabled = 'false';
      }
      if (!attrs.editEnabled) {
        attrs.editEnabled = 'false';
      }
      if (!attrs.selectionEnabled) {
        attrs.selectionEnabled = 'true';
      }
      if (!attrs.inlineCategoryEditEnabled) {
        attrs.inlineCategoryEditEnabled = 'false';
      }
    }
  }
}