(function(Desmond) {

  var SidebarController = function(AccountsRepository, MovementsRepository) {
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
  };
  SidebarController.$inject = ['AccountsRepository', 'MovementsRepository'];

  Desmond.controller('SidebarController', SidebarController);

})(window.angular.module('Desmond'));