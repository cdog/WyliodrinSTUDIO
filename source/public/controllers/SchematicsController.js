'use strict';

var _ = require ('lodash');
var angular = require ('angular');
var d3 = require ('d3');
var library = require ('library');
var mixpanel = require ('mixpanel');
var settings = require ('settings');

require ('debug').enable (settings.debug);

var debug = require ('debug')('wyliodrin:lacy:SchematicsController');

debug ('Loading');

module.exports = function ()
{
  if (typeof window.Wyliodrin === 'undefined') {
    window.Wyliodrin = {};
  }

  (function (Wyliodrin) {
    Wyliodrin.bc = { // Breadboard Circuits
      parts: [],
      libraryPath: '/public/drawable/parts'
    };
  })(Wyliodrin);

  var canvasId = 'canvas';
  var canvasWidth = '100%';
  var canvasHeight = '100%';

  var gridId = 'grid';
  var gridSize = 80;
  var gridFill = 'none';
  var gridStroke = '#ddd';
  var gridStrokeWidth = 1;

  var zoomed = function () {
    pattern.attr('patternTransform', 'translate(' + d3.event.translate + ') scale(' + d3.event.scale + ')');
    defs.select('path').attr('stroke-width', 0.5 / d3.event.scale);
    pattern.select('path').attr('stroke-width', 1 / d3.event.scale);
    group.attr('transform', 'translate(' + d3.event.translate + ') scale(' + d3.event.scale + ')');
  };

  var zoom = d3.behavior.zoom()
    .scaleExtent([0.5, 4])
    .on('zoom', zoomed);

  var dragstarted = function () {
    d3.event.sourceEvent.stopPropagation();
    d3.select(this).classed('dragging', true);
  };

  var dragged = function () {
    d3.select(this)
      .attr('x', d3.event.x)
      .attr('y', d3.event.y);
  };

  var dragended = function () {
    d3.select(this).classed('dragging', false);
  };

  d3.behavior.drag()
    .origin(function () {
      return {
        x: d3.select(this).attr('x'),
        y: d3.select(this).attr('y')
      };
    })
    .on('dragstart', dragstarted)
    .on('drag', dragged)
    .on('dragend', dragended);

  var canvas = d3.select('#viewport')
    .append('svg:svg')
    .attr('id', canvasId)
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .call(zoom)
    .on('mousedown', function () {
      canvas.style('cursor', 'grabbing');
    })
    .on('mouseup', function () {
      canvas.style('cursor', 'grab');
    })
    .style('cursor', 'grab');

  var defs = canvas.append('defs');

  var pattern = defs.append('pattern')
    .attr('id', 'grid-inner')
    .attr('width', 8)
    .attr('height', 8)
    .attr('patternUnits', 'userSpaceOnUse');

  pattern.append('path')
    .attr('d', 'M ' + '8' + ' 0 L 0 0 0 ' + '8')
    .attr('fill', gridFill)
    .attr('stroke', '#eee')
    .attr('stroke-width', 0.5);

  pattern = defs.append('pattern')
    .attr('id', gridId)
    .attr('width', gridSize)
    .attr('height', gridSize)
    .attr('patternUnits', 'userSpaceOnUse');

  pattern.append('rect')
    .attr('fill', 'url(#grid-inner)')
    .attr('width', gridSize)
    .attr('height', gridSize);

  pattern.append('path')
    .attr('d', 'M ' + gridSize + ' 0 L 0 0 0 ' + gridSize)
    .attr('fill', gridFill)
    .attr('stroke', gridStroke)
    .attr('stroke-width', gridStrokeWidth);

  var grid = canvas.append('rect')
    .attr('width', canvasWidth)
    .attr('height', canvasHeight)
    .attr('fill', 'url(#' + gridId + ')');

  grid.visible = true;

  var group = canvas.append('g');

  function loadParts($http, $rootScope, $scope) {
    $http.get(Wyliodrin.bc.libraryPath + '/parts.json', {
      eventHandlers: {
        progress: function (event) {
          if (event.lengthComputable) {
            var progress = event.loaded / event.total;

            $scope.progress = progress * 100;
          }
        }
      }
    }).then(function (response) {
      Wyliodrin.bc.parts = response.data;

      $rootScope.$emit('bc:library:loaded');
    });
  }

  function flattenCategory(elem) {
    var parts = [];

    angular.forEach(elem, function (value, key) {
      var part = {
        key: key,
        title: value.title,
        type: value.type
      };

      if (value.type === 'part') {
        part.id = value.id;
        part.icon = Wyliodrin.bc.libraryPath + '/svg/icons/' + value.views.icon;
      }

      parts.push(part);

      if (value.type === 'group') {
        parts = parts.concat(flattenCategory(value.parts));
      }
    });

    return parts;
  }

  function _findPart(group, id) {
    if (group instanceof Array) {
      for (var i = 0; i < group.length; i++) {
        var part = _findPart(group[i], id);

        if (part !== false) {
          return part;
        }
      }
    }

    if (group.type === 'group') {
      return _findPart(group.parts, id);
    }

    return group.id === id ? group : false;
  }

  function findPart(id) {
    return _findPart(Wyliodrin.bc.parts, id);
  }

  var app = angular.module ('wyliodrinApp');

  app.controller('SchematicsController', function ($scope, $filter, $element, $wyapp, $timeout, $wysignalproperties, $mdDialog, $http, $rootScope, $q) {
    debug ('Registering');
    $scope.project =
    {
      schematics: ''
    };

    loadParts($http, $rootScope, $scope);

    $scope.resetView = function () {
      zoom.scale(1);
      zoom.translate([0, 0]);
      pattern.attr('patternTransform', null);
      group.attr('transform', null);
    };

    $scope.toggleGrid = function () {
      grid.visible = !grid.visible;

      var visibility = grid.visible ? 'visible' : 'hidden';

      grid.style('visibility', visibility);
    };

    $scope.category = null;
    $scope.categories = null;

    var x = $q(function (resolve) {
      $rootScope.$on('bc:library:loaded', function () {
        var categories = [];

        angular.forEach(Wyliodrin.bc.parts, function (value, key) {
          var category = {
            key: key,
            title: value.title
          };

          if (value.icon !== undefined) {
            category.icon = Wyliodrin.bc.libraryPath + '/icons/' + value.icon;
          }

          categories.push(category);
        });

        $scope.category = categories[2].key;
        $scope.categories = categories;

        resolve();
      });
    });

    $scope.loadCategories = function () {
      return $scope.categories || x;
    };

    $scope.parts = null;

    $scope.loadCategory = function () {
      if ($scope.category === null) {
        return;
      }

      $scope.parts = flattenCategory(Wyliodrin.bc.parts[$scope.category].parts);
    };

    $scope.$watch('category', $scope.loadCategory);

    $scope.part = null;

    $scope.inspect = function (id) {
      var part = findPart(id);

      $scope.part = {
        description: part.description,
        properties: part.properties,
        tags: part.tags,
        title: part.title
      };
    };

    $scope.deinspect = function () {
      $scope.part = null;
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
