export default class SidebarController {
  constructor(AccountsRepository, MovementsRepository) {
    this.accounts = AccountsRepository;
    this.movements = MovementsRepository;
  }
}
SidebarController.$inject = ['AccountsRepository', 'MovementsRepository'];
