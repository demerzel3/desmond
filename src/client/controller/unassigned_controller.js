class UnassignedController {
  constructor($scope, MovementsRepository) {
    this.movements = MovementsRepository;
    this.filteredMovements = this.movements.findOutgoingUnassignedCategory();

    $scope.$watch('ctrl.movements.all', () => {
      this.filteredMovements = this.movements.findOutgoingUnassignedCategory();
    });
  }
}
UnassignedController.$inject = ['$scope', 'MovementsRepository'];

export default UnassignedController;