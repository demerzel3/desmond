(function($, angular) {

  /**
   * @param name
   * @param callable
   * @param [priority]
   * @constructor
   */
  var Rule = function(name, callable, priority) {
    this.name = name;
    this.callable = callable;
    this.priority = priority || 0;
  };

  var RulesContainer = function() {
    this.rules = [];
  };
  RulesContainer.prototype.rule = function(name, callable, priority) {
    var rule = new Rule(name, callable, priority);
    this.rules.push(rule);
    this.rules = _.sortBy(this.rules, 'priority');
  };
  RulesContainer.prototype.applyAll = function(movement) {
    _.each(this.rules, function(rule) {
      rule.callable.apply(movement, [movement]);
    });
  };

  var Service = angular.module('Desmond.Service', []);
  Service.service('RulesContainer', RulesContainer);

})(window.jQuery, window.angular);