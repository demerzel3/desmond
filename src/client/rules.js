
class DefaultRulesProvider {
  constructor(CategoriesRepository, AccountsRepository, Movement) {
    this.CategoriesRepository = CategoriesRepository;
    this.AccountsRepository = AccountsRepository;
    this.Movement = Movement;
  }

  registerRules(container) {
    container.rule('F24', (movement) => {
      if (movement.description.indexOf('ADDEBITO DELEGA F24') > -1) {
        movement.category = this.CategoriesRepository.find('imposte');
        return true;
      }
    });

    container.rule('Bollo', (movement) => {
      if (movement.description.indexOf('IMPOSTA DI BOLLO') > -1) {
        movement.category = this.CategoriesRepository.find('imposte');
        return true;
      }
    });

    container.rule('Commissioni', (movement) => {
      if (movement.description.indexOf('COMMISSIONI OPERAZIONI') > -1
        || movement.description.indexOf('SPESE DI APERTURA') > -1
        || movement.description.indexOf('CANONE CONTO') > -1
        || movement.description.indexOf('COSTO CARNET ASSEGNI') > -1
        || movement.description.indexOf('SPESE DI REGISTRAZIONE') > -1
        || movement.description.indexOf('SPESE INVIO DOCUMENTO') > -1
        || movement.description.indexOf('SPESE INVIO E/C') > -1
        || movement.description.indexOf('RECUPERO SPESE') > -1) {
        movement.category = this.CategoriesRepository.find('commissioni');
        return true;
      }
    });

    container.rule('Interessi', (movement) => {
      if (movement.direction === this.Movement.DIRECTION_IN && (
        movement.description.indexOf('COMPETENZE LIQUIDAZIONE') > -1
        || movement.description.indexOf('COMPETENZE BONUS') > -1
        || movement.description.indexOf('COMPETENZE AL CONTO') > -1
        || movement.description.indexOf('COMPETENZE SU C/C') > -1)) {
        //movement.category = CategoriesRepository.find('investimenti');
        movement.source = this.AccountsRepository.findByName('Interessi');
        return true;
      }
    });

    container.rule('Supermercati e Alimentari', (movement) => {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1
        || movement.description.indexOf('ACQUISTO CARTA DI CREDITO') > -1
        || (movement.description.indexOf('Pagamento') > -1 && movement.description.indexOf('POS') > -1)) {
        if (movement.description.indexOf('ESSELUN') > -1
          || movement.description.indexOf('AUCHAN') > -1
          || movement.description.indexOf('IPERCOO') > -1
          || movement.description.indexOf('CONAD') > -1
          || movement.description.indexOf('TIGROS') > -1
          || movement.description.indexOf('BOFROST') > -1
          || movement.description.indexOf('CARREFOUR') > -1
          || movement.description.indexOf('GIGANTE') > -1
          || movement.description.indexOf('LIDL') > -1) {
          movement.category = this.CategoriesRepository.find('supermercato');
          return true;
        }
      }
    });

    container.rule('Carburante', (movement) => {
      if (movement.description.indexOf('PAGOBANCOMAT') > -1
        || movement.description.indexOf('ACQUISTO CARTA DI CREDITO') > -1) {
        if (movement.description.indexOf('ESSO') > -1
          || movement.description.indexOf('Q8') > -1) {
          movement.category = this.CategoriesRepository.find('carburante');
          return true;
        }
      }
    });

    container.rule('Voli', (movement) => {
      if (movement.description.indexOf('EASYJET') > -1) {
        movement.category = this.CategoriesRepository.find('viaggi');
        return true;
      }
    });

    container.rule('Ristoranti', (movement) => {
      if (movement.description.indexOf('RISTORAN') > -1
        || movement.description.indexOf('OSTERIA') > -1
        || movement.description.indexOf('RESTAURANT') > -1) {
        movement.category = this.CategoriesRepository.find('tempo_libero');
        return true;
      }
    });

    container.rule('Cinema', (movement) => {
      if (movement.description.indexOf('SKYLINE') > -1
        || movement.description.indexOf('UCI MILANO') > -1
        || movement.description.indexOf('EUROPLEX') > -1) {
        movement.category = this.CategoriesRepository.find('tempo_libero');
        return true;
      }
    });

    container.rule('Farmacie', (movement) => {
      if (movement.description.indexOf('FARMACIA') > -1) {
        movement.category = this.CategoriesRepository.find('farmaci');
        return true;
      }
    });

    container.rule('Abbigliamento', (movement) => {
      if (movement.description.indexOf('GEOX') > -1
        || movement.description.indexOf('PIAZZA ITALIA') > -1
        || movement.description.indexOf('SANTINO PUNTO MODA') > -1) {
        movement.category = this.CategoriesRepository.find('abbigliamento');
        return true;
      }
    });

    container.rule('Mutuo', (movement) => {
      if (movement.description.indexOf('RIMBORSO FINANZIAMENTO N.') > -1) {
        movement.category = this.CategoriesRepository.find('mutuo');
        return true;
      }
    });

    container.rule('Mutuo', (movement) => {
      if (movement.description.indexOf('ADDEBITO SEPA DD') > -1) {
        movement.category = this.CategoriesRepository.find('bollette');
        return true;
      }
    });


    container.rule('Trasferimenti', (movement) => {
      if (movement.account.bank === 'bnl') {
        if (movement.description.indexOf('VERSAMENTO DI CONTANTE O ASSIMILATI') > -1) {
          movement.source = this.AccountsRepository.moneyAccount;
          return true;
        }
        if (movement.description.indexOf('BONIFICO A VOSTRO FAVORE') > -1) {
          if (movement.description.indexOf('DA DE CARLO BARBARA, GENTA GABRIELE') > -1) {
            movement.source = this.AccountsRepository.findByName('IWBank');
          } else if (movement.description.indexOf('GENTA GABRIELE') > -1) {
            movement.source = this.AccountsRepository.findByName('Gabriele');
          } else if (movement.description.indexOf('DE CARLO BARBARA') > -1) {
            movement.source = this.AccountsRepository.findByName('Barbara');
          }
          return true;
        }
      } else if (movement.account.bank === 'iwbank') {
        if (movement.description.indexOf('VERSAMENTO C/O POSTE') > -1) {
          movement.source = this.AccountsRepository.moneyAccount;
          return true;
        }
        if (movement.description.indexOf('BONIFICO A VS. FAVORE') > -1
          || movement.description.indexOf('BONIFICO A VOSTRO FAVORE') > -1
          || movement.description.indexOf('PRIMO BONIFICO') > -1) {
          if (movement.description.toUpperCase().indexOf('GENTA GABRIELE') > -1
            || movement.description.toUpperCase().indexOf('NPCREW S.R.L.') > -1) {
            movement.source = this.AccountsRepository.findByName('Gabriele');
          } else if (movement.description.toUpperCase().indexOf('DE CARLO BARBARA') > -1) {
            movement.source = this.AccountsRepository.findByName('Barbara');
          } else if (movement.description.toUpperCase().indexOf('MARICA') > -1) {
            movement.source = this.AccountsRepository.findByName('Marica');
          } else if (movement.description.toUpperCase().indexOf('GIUSEPPE DE CARLO') > -1
            || movement.description.toUpperCase().indexOf('DE CARLO GIUSEPPE') > -1) {
            movement.source = this.AccountsRepository.findByName('Pino');
          } else if (movement.description.toUpperCase().indexOf('GENTA LUCIANO') > -1) {
            movement.source = this.AccountsRepository.findByName('Luciano');
          }
          return true;
        }
        if (movement.description.indexOf('GIROCONTO') > -1
          || movement.description.indexOf('GIRO COMPETENZE') > -1) {
          if (movement.description.indexOf('CAPITALE A SCADENZA') > -1
            || movement.description.indexOf('TRASFERIMENTO IN') > -1
            || movement.description.indexOf('TRASFERIMENTO OUT')) {
            var iwPower = this.AccountsRepository.findByName('IWPower');
            if (this.Movement.DIRECTION_IN === movement.direction) {
              movement.source = iwPower;
            } else {
              movement.destination = iwPower;
            }
          }
          return true;
        }
      } else if (movement.account.bank === 'iwpower') {
        //console.log(movement.description);
        if (movement.description.indexOf('GIROCONTO') > -1
          || movement.description.indexOf('GIRO COMPETENZE AL CONTO') > -1) {
          var iwBank = this.AccountsRepository.findByName('IWBank');
          if (this.Movement.DIRECTION_IN === movement.direction) {
            movement.source = iwBank;
          } else {
            movement.destination = iwBank;
          }
          return true;
        }
      }
    })
  }
}
DefaultRulesProvider.$inject = ['CategoriesRepository', 'AccountsRepository', 'Movement'];

var Rules = angular.module('Desmond.Rules', ['Desmond.Service', 'Desmond.Model']);
Rules.service('DefaultRulesProvider', DefaultRulesProvider);

Rules.run(['RulesContainer', 'DefaultRulesProvider', function(RulesContainer, DefaultRulesProvider) {
  DefaultRulesProvider.registerRules(RulesContainer);
}]);