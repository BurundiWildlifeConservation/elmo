// ELMO.Views.Dashboard
//
// View model for the Dashboard
(function(ns, klass) {

  var AJAX_RELOAD_INTERVAL = 30; // seconds
  var PAGE_RELOAD_INTERVAL = 30; // minutes

  // constructor
  ns.Dashboard = klass = function(params) { var self = this;
    self.params = params;

    // hook up full screen link
    $("a.full-screen").on('click', function(obj) {self.toggle_view_setting('full-screen'); return false;});

    // hook up expand map link
    $("a.toggle-map").on('click', function(obj) {self.toggle_view_setting('expanded-map'); return false;});

    // readjust stuff on window resize
    $(window).on('resize', function(){
      self.adjust_pane_sizes();
      self.list_view.adjust_columns();

      // clear this timeout in case this is another resize event before it ran out
      clearTimeout(self.resize_done_timeout)

      // set a timeout to refresh the report
      if (ELMO.app.report_controller) {
        self.resize_done_timeout = setTimeout(function(){
          ELMO.app.report_controller.refresh_view();
        }, 1000);
      }
    })

    // Setup ajax reload timer and test link.
    self.reload_timer = setTimeout(function(){ self.reload_ajax(); }, AJAX_RELOAD_INTERVAL * 1000);
    $('a.reload-ajax').on('click', function(){ self.reload_ajax(); });

    // Setup long-running page reload timer, unless it already exists.
    // This timer ensures that we don't have memory issues due to a long running page.
    if (!ELMO.app.dashboard_reload_timer) {
      ELMO.app.dashboard_reload_timer = setTimeout(function(){ self.reload_page(); }, PAGE_RELOAD_INTERVAL * 60000);
      $('a.reload-page').on('click', function() { self.reload_page(); });
    }
    // adjust sizes for the initial load
    self.adjust_pane_sizes();

    // save mission_id as map serialization key
    self.params.map.serialization_key = self.params.mission_id;

    // create classes for screen components
    self.list_view = new ELMO.Views.DashboardResponseList();
    self.map_view = new ELMO.Views.DashboardMapView(self.params.map);
    self.report_view = new ELMO.Views.DashboardReport(self, self.params.report);

    self.list_view.adjust_columns();
  };

  klass.prototype.run_report = function() {
    this.report_view.refresh();
  };

  klass.prototype.adjust_pane_sizes = function() { var self = this;
    // set 3 pane widths/heights depending on container size

    // the content window padding and space between columns
    var spacing = 15;

    // content window inner dimensions
    var cont_w = $('#content').width() - 4;
    var cont_h = $(window).height() - $('#title').outerHeight(true) - $('#main-nav').outerHeight(true) - 4 * spacing;

    // height of the h2 elements
    var title_h = $('#content h2').height();

    // height of the stats pane
    var stats_h = $('.report_stats').height();

    // left col is slightly narrower than right col
    var left_w = (cont_w - spacing) * .9 / 2;
    $('.recent_responses, .response_locations').width(left_w);
    var right_w = cont_w - spacing - left_w - 15;
    $('.report_main').width(right_w);

    // must control width of stat block li's
    $('.report_stats .stat_block li').css('maxWidth', (right_w / 3) - 25);

    // must control report title width or we get weird wrapping
    $('.report_pane h2').css('maxWidth', right_w - 200);

    // for left panes height we subtract 2 title heights plus 3 spacings (2 bottom, one top)
    $('.recent_responses, .response_locations').height((cont_h - 2 * title_h - 3 * spacing) / 2);

    // for report pane we subtract 1 title height plus 2 spacings (1 bottom, 1 top) plus the stats pane height
    $('.report_main').height(cont_h - title_h - 2 * spacing - stats_h);
  };

  // Reloads the page via AJAX, passing the current report id
  klass.prototype.reload_ajax = function(args) { var self = this;
    // Don't have session timeout if in full screen mode
    var full_screen = JSON.parse(localStorage.getItem("full-screen")) ? 1 : undefined;

    // only set the 'auto' parameter on this request if in full screen mode
    // the dashboard in full screen mode is meant to be a long-running page so doesn't make
    // sense to let the session expire

    $.ajax({
      url: ELMO.app.url_builder.build('/'),
      method: 'GET',
      data: {
        report_id: self.report_view.current_report_id,
        latest_response_id: self.list_view.latest_response_id(),
        auto: full_screen
      },
      success: function(data) {
        $('.recent_responses').replaceWith(data.recent_responses);
        $('.report_stats').replaceWith(data.report_stats);
        self.map_view.update_map(data.response_locations);
        self.report_view.refresh();
        self.adjust_pane_sizes();

        self.reload_timer = setTimeout(function(){ self.reload_ajax(); }, AJAX_RELOAD_INTERVAL * 1000);
      },
      error: function() {
        $('#content').html(I18n.t('layout.server_contact_error'));
      }
    });
  };

  // Reloads the page via full refresh to avoid memory issues.
  klass.prototype.reload_page = function() { var self = this;
    var id;
    window.location.href = ELMO.app.url_builder.build('')
      + '?r=' + Math.floor((Math.random() * 1000000) + 1)
      + ((id = self.report_view.current_report_id) ? '&report_id=' + id : '');
  };

  // Toggles the value of a setting stored in localStorage, then calls the execute method to make the change.
  klass.prototype.toggle_view_setting = function(setting_name) { var self = this;
    var current = JSON.parse(localStorage.getItem(setting_name));
    current ? localStorage.setItem(setting_name, false) : localStorage.setItem(setting_name, true);
    self.execute_view_setting(setting_name);
  };

  // Reads a view setting from localStorage and makes it happen.
  klass.prototype.execute_view_setting = function(setting_name) { var self = this;
    var setting = JSON.parse(localStorage.getItem(setting_name));

    switch (setting_name) {

    case 'full-screen':

      // if not in full screen mode, show everything (default)
      if (!setting) {
        $('#footer').show();
        $('#main-nav').show();
        $('#userinfo').show();
        $('#title img').css('height', 'initial');
        $('a.full-screen i').removeClass('fa-compress').addClass('fa-expand');
      // else full screen is true, hide things
      } else {
        $('#footer').hide();
        $('#main-nav').hide();
        $('#userinfo').hide();
        $('#title img').css('height', '30px');
        $('a.full-screen i').removeClass('fa-expand').addClass('fa-compress');
      }

      // Set link text
      $('a.full-screen span').text(I18n.t('dashboard.' + (setting ? 'exit' : 'enter') + '_full_screen'));

    case 'expanded-map':
      if ($('#content').is('.expanded-map'))
        $('#content').removeClass('expanded-map');
      else
        $('#content').addClass('expanded-map');

    }
  };

}(ELMO.Views));
