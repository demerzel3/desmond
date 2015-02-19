import Statistics from 'service/statistics.js';

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
/**
 * Apply all the rules to a movement, stopping at the first that applies successfully.
 *
 * @param movement
 */
RulesContainer.prototype.applyAll = function(movement) {
  _.each(this.rules, function(rule) {
    if (rule.callable.apply(movement, [movement])) {
      movement._appliedRule = rule.name;
      return false;
    }
  });
};




var PageMetadata = function() {
  this.title = "Desmond";
};



var FileHasher = function($q) {
  this.$q = $q;
};
FileHasher.$inject = ['$q'];
/**
 * Adds an hash filed to the file and returns it (promise).
 *
 * @param file
 * @returns {Promise<File>}
 */
FileHasher.prototype.hashFile = function(file) {
  var readData = this.$q(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    reader.readAsBinaryString(file);
  });

  return readData.then(function(binaryData) {
    file.hash = SparkMD5.hashBinary(binaryData);
    return file;
  });
};

var Service = angular.module('Desmond.Service', []);
Service.service('RulesContainer', RulesContainer);
Service.service('PageMetadata', PageMetadata);
Service.service('FileHasher', FileHasher);
Service.service('Statistics', Statistics);
