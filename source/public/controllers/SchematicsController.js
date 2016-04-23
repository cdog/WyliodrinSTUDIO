'use strict';

var _ = require ('lodash');
var angular = require ('angular');
var library = require ('library');
var mixpanel = require ('mixpanel');
var settings = require ('settings');

require ('debug').enable (settings.debug);

var debug = require ('debug')('wyliodrin:lacy:SchematicsController');

debug ('Loading');

module.exports = function ()
{
  var app = angular.module ('wyliodrinApp');

  app.controller('SchematicsController', function ($scope, $filter, $element, $wyapp, $timeout, $wysignalproperties, $mdDialog) {
    debug ('Registering');
    $scope.project =
    {
      schematics: ''
    };

    $wyapp.on ('load', function (project)
    {
      $timeout (function ()
      {
        $scope.project = project;
      });
    });
  });
};
