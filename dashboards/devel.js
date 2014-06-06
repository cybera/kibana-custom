/* global _ */

/*
 * Complex scripted Logstash dashboard
 * This script generates a dashboard object that Kibana can load. It also takes a number of user
 * supplied URL parameters, none are required:
 *
 * index :: Which index to search? If this is specified, interval is set to 'none'
 * pattern :: Does nothing if index is specified. Set a timestamped index pattern. Default: [logstash-]YYYY.MM.DD
 * interval :: Sets the index interval (eg: day,week,month,year), Default: day
 *
 * split :: The character to split the queries on Default: ','
 * query :: By default, a comma separated list of queries to run. Default: *
 *
 * from :: Search this amount of time back, eg 15m, 1h, 2d. Default: 15m
 * timefield :: The field containing the time to filter on, Default: @timestamp
 *
 * institution :: adds a filter based on the institution field
 * environment :: adds a filter on the host field, this isn't a perfect way to filter environments, but unless we
 *                explicitly add a 'environment' field we'll have to do it this way.
 * pages :: a comma separated list of pages that we want to analyze
 */

'use strict';

// Setup some variables
var dashboard;
var queries = {};
var _d_timespan;
var ARGS; // All url parameters are available via the ARGS object

// We supply a default set of pages, additional pages can be added as a comma separated list in the 'pages' URL param
var pages = [
  {
    path: "/",
  },
  {
    path: "/my/",
  },
  {
    path: "/login/index.php",
  },
  {
    path: "/mod/quiz/processattempt.php",
  },
  {
    path: "/mod/forum/discuss.php\"*\"",
  }
];
if (!_.isUndefined(ARGS.pages)) {
  var page_array = ARGS.pages.split(',') || [];
  for (var i in page_array) {
    pages.push({path: page_array[i]});
  }
}

// Set a default timespan if one isn't specified
_d_timespan = '4h';

// Intialize a skeleton with nothing but a rows array and service object
dashboard = {
  rows : [],
  services : {}
};

// Set a title
dashboard.title = 'Development Dash';

// Allow the user to set the index, if they dont, fall back to logstash.
if(!_.isUndefined(ARGS.index)) {
  dashboard.index = {
    default: ARGS.index,
    interval: 'none'
  };
} else {
  // Don't fail to default
  dashboard.failover = false;
  dashboard.index = {
    default: ARGS.index||'ADD_A_TIME_FILTER',
    pattern: ARGS.pattern||'[logstash-]YYYY.MM.DD',
    interval: ARGS.interval||'day'
  };
}

var all_query = [];
for (var i in pages) {
  i = parseInt(i);
  var path = pages[i]['path'];
  var path_query = 'request.raw:"' + pages[i]['path'] + '"';
  pages[i]['query_id'] = i + 1;
  all_query.push(path_query);
  queries[i + 1] = {
    query: path_query,
    //alias: "all pages",
    type: "lucene",
    id: i + 1,
  };
}
queries[0] = {
  query: all_query.join(" OR "),
  alias: "all pages",
  type: "lucene",
  id: 0,
};

// Now populate the query service with our objects
dashboard.services.query = {
  list : queries,
  ids : _.map(_.keys(queries),function(v){return parseInt(v,10);})
};

// Lets also add a default time filter, the value of which can be specified by the user
dashboard.services.filter = {
  list: {
    0: {
      from: "now-"+(ARGS.from||_d_timespan),
      to: "now",
      field: ARGS.timefield||"@timestamp",
      type: "time",
      active: true,
      id: 0,
    },
    1: {
      type: "terms",
      field: "_type",
      value: "apache-access",
      mandate: "must",
      active: true,
      id: 1
    },
    2: {
      type: "terms",
      field: "institution",
      value: ARGS.institution,
      mandate: "must",
      active: !_.isUndefined(ARGS.institution),
      id: 2
    },
    3: {
      type: "terms",
      field: "host",
      value: ARGS.environment,
      mandate: "must",
      active: !_.isUndefined(ARGS.environment),
      id: 3
    }
  },
  ids: [0,1,2,3]
};

// Ok, lets make some rows. The Filters row is collapsed by default
dashboard.rows = [
  {
    title: "Aggregate Stats",
    collapsable: false,
    editable: false,
    height: "150px"
  },
  {
    title: "Page Stats",
    collapsable: false,
    editable: false,
    height: "150px"
  },
  {
    title: "table",
    collapsable: false,
    editable: false,
    height: "150px"
  }
];

dashboard.rows[0].panels = [
  {
    span: 6,
    title: 'Events For All Pages',
    type: 'histogram',
    editable: false,
    movable: false,
    time_field: ARGS.timefield||"@timestamp",
    grid: {
      max: null,
      min: 0
    },
    auto_int: true,
    bars: false,
    stack: false,
    lines: true,
    fill: 1,
    legend: true,
    queries: {
      mode: 'selected',
      ids: [0]
    }
  },
  {
    span: 6,
    title: 'Response Time (seconds)',
    type: 'histogram',
    editable: false,
    time_field: ARGS.timefield||"@timestamp",
    value_field: "response_time",
    scale: "0.000001",
    mode: "mean",
    grid: {
      max: null,
      min: 0
    },
    auto_int: true,
    bars: false,
    stack: false,
    lines: true,
    fill: 1,
    legend: true,
    queries: {
      mode: 'selected',
      ids: [0]
    }
  },
];

dashboard.rows[1].panels = [
  {
    title: 'stats by page',
    type: 'pageload',
    span: 12,
    editable: false,
    group: [
      "default"
    ],
    pages: pages,
    style: {},
    status: "stable"
  }
];
/*
dashboard.rows[2].panels = [
  {
    title: 'stats by page',
    type: 'table',
    span: 12,
    editable: false,
    group: [
      "default"
    ],
    style: {},
    status: "stable"
  }
];
*/
dashboard["loader"] = {
  save_gist: false,
  save_elasticsearch: false,
  save_local: false,
  save_temp: true,
  save_temp_ttl_enable: true,
  save_temp_ttl: "30d",
};
dashboard["pulldowns"] = [
  {
    type: "query",
    enable: false
  },
  {
    type: "filtering",
    enable: false
  }
];

dashboard["editable"] = false;

// Now return the object and we're good!
return dashboard;

