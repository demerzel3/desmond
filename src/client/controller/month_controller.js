class MonthController {
  constructor($stateParams, $scope, $timeout, $modal, MovementsRepository, Statistics, Restangular) {
    this.$timeout = $timeout;
    this.$modal = $modal;
    this.Restangular = Restangular;
    this.month = $stateParams.month;
    this.stat = Statistics.outgoingByCategoryByMonth;

    this.movements = MovementsRepository;
    this.filteredMovements = [];
    this.categories = [];
    this.total = 0;
    this.selectedItems = [];

    if (this.movements.all.length > 0) {
      this.initData();
    }

    $scope.$watch('ctrl.movements.all', (movements, oldValue) => {
      if (movements === oldValue) {
        return;
      }
      this.stat.refresh();
      this.initData();
    });
  }

  initData() {
    var ctrl = this;

    this.registerCategoriesStyles(this.stat.categories);

    var monthIndex = _.findIndex(this.stat.months, function(month) {
      return month.id === ctrl.month;
    });
    if (monthIndex === -1) {
      return;
    }

    this.categories = this.stat.categories.map((category) => {
      var cat = angular.copy(category);
      cat.monthTotal = category.data[monthIndex];
      return cat;
    }).filter((category) => {
      return category.monthTotal > 0;
    });

    var categoriesOrder = {};
    this.categories.forEach(function(category, index) {
      categoriesOrder[category._id] = index + 1;
    });

    var movements = this.movements.all.filter((movement) => {
      return movement.date.format('YYYY-MM') === ctrl.month; /*movement.direction === 'out'
        && movement.date.format('YYYY-MM') === ctrl.month
        && (!movement.destination || 'bank_account' !== movement.destination.type)*/;
    });
    movements.sort(function(movA, movB) {
      var catA = movA.category ? movA.category._id : null;
      var catB = movB.category ? movB.category._id : null;
      if (catA === catB || !categoriesOrder[catA] && !categoriesOrder[catB]) {
        return movB.date.diff(movA.date);
      } else if (!categoriesOrder[catB]) {
        return -1;
      } else if (!categoriesOrder[catA]) {
        return 1;
      } else if (categoriesOrder[catA] > categoriesOrder[catB]) {
        return 1;
      } else {
        return -1;
      }
    });
    this.filteredMovements = movements;

    this.total = this.categories.reduce((sum, category) => sum + category.monthTotal, 0);

    this.$timeout(function() {
      ctrl.updateFunnel();
    });
  }

  registerCategoriesStyles(categories) {
    var sheet = (function() {
      var style = document.createElement("style");
      // WebKit hack :(
      style.appendChild(document.createTextNode(""));
      document.head.appendChild(style);
      return style.sheet;
    })();
    categories.forEach(function(category, index) {
      var hsl = tinycolor(category.color).toHsl();
      hsl.s = Math.max(hsl.s, hsl.s - 0.4);
      hsl.l = 0.95;
      var color = tinycolor(hsl);
      sheet.insertRule('#monthView table.table-movements tr[category="' + category._id + '"] {background-color: ' + color.toString() + '}', index);
    });
  }

  updateFunnel() {
    var $el = $('#monthView');
    var categories = $el.find('.categories > div');
    var rows = $el.find('tbody > tr').toArray();
    var movements = [].concat(this.filteredMovements);

    var items = this.categories.map((category, index) => {
      var catEl = categories.eq(index);
      var pos = catEl.position();
      var funnelItem = {
        color: category.color,
        left: {
          from: pos.top,
          to: pos.top + catEl.height()
        }
      };

      var catRows = [];
      if (category._id) {
        while (movements.length > 0 && movements[0].category && movements[0].category._id === category._id) {
          catRows.push(rows.shift());
          movements.shift();
        }
      } else {
        while (movements.length > 0 && !movements[0].category) {
          catRows.push(rows.shift());
          movements.shift();
        }
      }

      funnelItem.right = {
        from: $(catRows[0]).position().top + 1
      };
      var rowsHeight = catRows.reduce((totalHeight, row) => {
          return totalHeight + $(row).height();
        }, 0) - 1;
      funnelItem.right.to = funnelItem.right.from + rowsHeight;

      return funnelItem;
    });

    var funnelEl = $el.find('.funnel').empty();
    var size = {width: funnelEl.width(), height: funnelEl.height()};

    var paper = Raphael(funnelEl[0]);
    var paths = items.map((item) => {
      var pathString = 'M' + 0 + ',' + item.left.from + 'L' + size.width + ',' + item.right.from
        + 'L' + size.width + ',' + item.right.to + 'L' + 0 + ',' + item.left.to + 'Z';
      var path = paper.path(pathString);
      path.attr({
        fill: item.color,
        stroke: 'transparent'
      });
      return path;
    });

    var updateFunnel = function() {
      var scrollTop = $el.find('.main-box')[0].scrollTop;
      var newSize = {width: size.width, height: funnelEl.height()};
      if (newSize.height !== size.height) {
        paper.setSize(newSize.width, newSize.height);

        // update from
        items.forEach(function(item, index) {
          var catEl = categories.eq(index);
          var pos = catEl.position();
          item.left.from = pos.top;
          item.left.to = pos.top + catEl.height();
        });
      }
      paths.forEach(function(path, index) {
        var item = items[index];
        var pathString = 'M' + 0 + ',' + item.left.from + 'L' + newSize.width + ',' + (item.right.from - scrollTop)
          + 'L' + newSize.width + ',' + (item.right.to - scrollTop) + 'L' + 0 + ',' + item.left.to + 'Z';
        path.attr('path', pathString);
      });
    };

    $('.main-box').on('scroll', updateFunnel);
    $(window).resize(_.debounce(updateFunnel, 250));
  }

  toggleAllSelection() {
    if (this.selectedItems.length < this.filteredMovements.length) {
      this.selectedItems = [].concat(this.filteredMovements);
    } else {
      this.selectedItems = [];
    }
  }

  deleteSelected(message) {
    message = message || 'Eliminare i movimenti selezionati?';
    swal({
      title: message,
      type: 'warning',
      allowOutsideClick: true,
      showCancelButton: true,
      confirmButtonColor: '#DD6B55',
      confirmButtonText: 'Elimina ' + this.selectedItems.length + ' movimenti',
      cancelButtonText: 'Annulla'
    }, (isConfirm) => {
      if (isConfirm) {
        for (let movement of this.selectedItems) {
          this.movements.remove(movement);
        }
      }
    });
  }

  mergeSelected() {
    // can only be from the same account
    if (_.uniq(_.pluck(this.selectedItems, 'account')).length > 1) {
      sweetAlert('Oops..', 'Non puoi unire movimenti di conti diversi, seleziona solo movimenti dello stesso conto.');
      return;
    }

    // build a new movement from the selected ones
    var amount = this.selectedItems.reduce((total, movement) => total + movement.amount, 0);
    if (amount.toFixed(2) === '0.00') {
      return this.deleteSelected('L\'unione degli elementi selezionati dà somma 0, vuoi eliminarli invece di unirli?');
    }

    var Movement = this.Movement;
    var newMovement = new Movement();
    newMovement.date = this.selectedItems[0].date;
    newMovement.executionDate = this.selectedItems[0].executionDate;
    newMovement.amount = amount;
    newMovement.direction = (amount > 0) ? Movement.DIRECTION_IN : Movement.DIRECTION_OUT;
    newMovement.account = this.selectedItems[0].account;
    newMovement.originatedBy = Movement.ORIGINATED_BY_MERGE;
    newMovement.originatedFrom = [].concat(this.selectedItems);
    newMovement.description = _.pluck(this.selectedItems, 'description').join('\n\n');
    newMovement.category = this.selectedItems.reduce(function(cat, movement) {
      if (!movement.category) {
        return cat;
      }
      if (_.isUndefined(cat)) {
        return movement.category;
      } else if (cat === movement.category) {
        return cat;
      } else {
        return null;
      }
    }, undefined);
    if (Movement.DIRECTION_IN === newMovement.direction) {
      newMovement.source = this.selectedItems.reduce((result, movement) => {
        if (!movement.source) {
          return result;
        }
        if (_.isUndefined(result)) {
          return movement.source;
        } else if (result === movement.source) {
          return result;
        } else {
          return null;
        }
      }, undefined);
    } else {
      newMovement.destination = this.selectedItems.reduce((result, movement) => {
        if (!movement.destination) {
          return result;
        }
        if (_.isUndefined(result)) {
          return movement.destination;
        } else if (result === movement.destination) {
          return result;
        } else {
          return null;
        }
      }, undefined);
    }

    this.editMovement(newMovement);
  }

  editMovement(movement) {
    var Restangular = this.Restangular;
    var isNew = !movement._id;
    var modal = this.$modal.open({
      templateUrl: 'components/edit_modal.html',
      controller: 'EditModalController as ctrl',
      size: 'lg',
      windowClass: ['edit-modal'],
      backdrop: 'static',
      resolve: {
        movement: () => {
          // copy the angular movement, mantaining the references to other objects
          // TODO: move this into the Movement model class?
          let copy = null;
          const LINK_FIELDS = [
            'document', 'account', 'category', 'source',
            'sourceMovement', 'destination', 'destinationMovement',
            'originatedFrom'];

          var savedFields = {};
          for (let fieldName of LINK_FIELDS) {
            savedFields[fieldName] = movement[fieldName];
            movement[fieldName] = null;
          }
          if (isNew) {
            copy = angular.copy(movement);
          } else {
            copy = Restangular.copy(movement);
          }
          for (let fieldName of LINK_FIELDS) {
            copy[fieldName] = savedFields[fieldName];
            movement[fieldName] = savedFields[fieldName];
          }
          return copy;
        }
      }
    });

    return modal.result.then((editedMovement) => {
      if (editedMovement.category && editedMovement.category._isNew) {
        return this.categories.add(editedMovement.category).then(function(newCategory) {
          editedMovement.category = newCategory;
          return editedMovement;
        });
      } else {
        return editedMovement;
      }
    }).then((editedMovement) => {
      if (isNew) {
        // argh...
        return this.movements.add(editedMovement).then(() => {
          if (editedMovement.originatedFrom) {
            for (let originalMovement of editedMovement.originatedFrom) {
              this.movements.remove(originalMovement);
            }
          }
        });
      } else {
        return this.movements.save(editedMovement);
      }
    });
  }

}
MonthController.$inject = ['$stateParams', '$scope', '$timeout', '$modal', 'MovementsRepository', 'Statistics', 'Restangular'];

export default MonthController;