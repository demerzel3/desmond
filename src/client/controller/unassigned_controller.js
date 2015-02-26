class UnassignedController {
  constructor($scope, MovementsRepository, CategoriesRepository) {
    this.movements = MovementsRepository;
    this.categories = CategoriesRepository;
    this.filteredMovements = this.movements.findOutgoingUnassignedCategory();

    $scope.$watch('ctrl.movements.all', (movements, oldValue) => {
      if (movements === oldValue) {
        return;
      }
      this.filteredMovements = this.movements.findOutgoingUnassignedCategory();
    });

    let deregisterItemsWatchers;
    $scope.$watch('ctrl.filteredMovements', (movements) => {
      if (movements.length == 0) {
        return;
      }
      // deregister
      if (deregisterItemsWatchers) {
        for (let deregisterFunction of deregisterItemsWatchers) {
          deregisterFunction();
        }
      }

      deregisterItemsWatchers = movements.map((movement, index) => {
        return $scope.$watch('ctrl.filteredMovements['+index+'].category', (newValue, oldValue) => {
          if (newValue === oldValue) {
            return;
          }
          this.categoryChangeHandler(movement);
        });
      });
    });
  }

  categoryChangeHandler(movement) {
    movement._loading = true;
    movement.save().then(function() {
      movement._success = true;
    }, function(e) {
      movement._error = e.message;
    });
  }

}
UnassignedController.$inject = ['$scope', 'MovementsRepository', 'CategoriesRepository'];

export default UnassignedController;