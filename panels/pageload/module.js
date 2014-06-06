/** @scratch /panels/5
 *
 * include::panels/text.asciidoc[]
 */

/** @scratch /panels/text/0
 * == text
 * Status: *Stable*
 *
 * The text panel is used for displaying static text formated as markdown, sanitized html or as plain
 * text.
 *
 */
define([
  'angular',
  'app',
  'jquery',
  'lodash',
  'require'
],
function (angular, app, $, _, kbn, moment) {
  'use strict';

  var module = angular.module('kibana.panels.pageload', []);
  app.useModule(module);

  // TODO: do we really need al the args to this function?? if so, what do they do?
  module.controller('pageload', function($rootScope, $scope, $modal, $q, $compile, $timeout, fields, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      status  : "Stable",
      description : "A Bonjour Word"
    };

    var mini_graph = {
      span: 2,
      height: 50,
      width: 200,
      type: "minigraph",
      time_field: "@timestamp",
      queries: {
        mode: "all",
        ids: [
          0
        ]
      },
    };

    var event_graph = $.extend(true, {
      mode: "count",
      value_field: null,
      grid: {
        max: null,
        min: 0
      },
    }, mini_graph);

    var response_time_graph = $.extend(true, {
      mode: "mean",
      value_field: "response_time",
      grid: {
        max: 5000000,
        min: 0
      },
    }, mini_graph);

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/pageload/5
       *
       * === Parameters
       *
       * mode:: `term1', `term2' or `term3'
       */
      terms    : "term2",
      pages    : [],
      queries: {
        mode: 'all',
        ids: []
      },
      style: {},
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      // Add graphs to each page
      for (var i = 0; i < $scope.panel.pages.length; ++i) {
        var query_id = $scope.panel.pages[i]["query_id"];
        $scope.panel.pages[i]["event_graph"] = {
          queries: {
            mode: "selected",
            ids: [query_id],
          },
        };
        $scope.panel.pages[i]["response_time_graph"] = {
          queries: {
            mode: "selected",
            ids: [query_id],
          },
        };
        $scope.panel.pages[i]["event_graph"] = [
          $.extend(true, {}, event_graph, $scope.panel.pages[i]["event_graph"])
        ];
        $scope.panel.pages[i]["response_time_graph"] = [
          $.extend(true, {}, response_time_graph, $scope.panel.pages[i]["response_time_graph"])
        ];
      }

      $scope.ready = false;
      $scope.$on('refresh', function() {
        console.log("refreshing panel");
        $scope.get_data();
      });
      $scope.reset_panel();
      $scope.get_data();
    };

    /*
     * callback for closing the edit pane
     */
    $scope.close_edit = function() {
      console.log("closed edit");
    }

    $scope.get_data = function() {
      if (dashboard.indices.length === 0) {
        return;
      }
      console.log("getting data -- START");
      $scope.panelMeta.loading = false;
      var request, results, boolQuery, queries;
      request = $scope.ejs.Request().indices(dashboard.indices);
      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries, function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request = request
        .facet($scope.ejs.StatisticalFacet('stats')
            .field('response_time')//$scope.panel.field)
            .facetFilter($scope.ejs.QueryFilter(
                $scope.ejs.FilteredQuery(
                  boolQuery,
                  filterSrv.getBoolFilter(filterSrv.ids())
                  )))).size(0);
      _.each(queries, function (q) {
        var alias = q.alias || q.query;
        var query = $scope.ejs.BoolQuery();
        query.should(querySrv.toEjsObj(q));
        request.facet($scope.ejs.StatisticalFacet('stats_' + alias)
          .field('response_time')//$scope.panel.field)
          .facetFilter($scope.ejs.QueryFilter(
              $scope.ejs.FilteredQuery(
                query,
                filterSrv.getBoolFilter(filterSrv.ids())
                )
              ))
          );
      });

      // Populate the inspector panel
      $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

      results = request.doSearch();

      results.then(function(results) {
        $scope.panelMeta.loading = false;
        var value = results.facets.stats[$scope.panel.mode];
        var rows = queries.map(function (q) {
          var alias = q.alias || q.query;
          var obj = _.clone(q);
          obj.label = alias;
          obj.Label = alias.toLowerCase(); // sort field
          obj.value = results.facets['stats_' + alias];
          obj.Value = results.facets['stats_' + alias]; // sort field
          return obj;
        });
        $scope.data_stats = {
          value: value,
          rows: rows
        };
        console.log("rows are:");
        console.log($scope.data_stats.rows[1].Value);
        console.log("-------END-------");
        $scope.$emit('render');
      });
    };

    $scope.reset_panel = function(type) {
      $scope.new_panel = {
        loading: false,
        error: false,
        sizeable: false,
        draggable: false,
        removable: false,
        span: 1,
        height: "100px",
        editable: false,
        type: type
      };
    };
  });
});
