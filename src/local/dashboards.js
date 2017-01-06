#!/usr/bin/env node
"use strict";

var LocalFS = require('../util/localfs.js');
var localfs = new LocalFS();
var Logger = require('../util/logger.js');
var logger = new Logger('dashboards');
var Table = require('cli-table');
var _ = require('lodash');

var dashDir = 'dashboards';

var TempVars = require('../local/temp-vars.js');
var Panels = require('../local/panels.js');
var Rows = require('../local/rows.js');

function Dashboards() {
	localfs.createIfNotExists(dashDir, 'dir', false);
	this.tempVars = new TempVars();
	this.panels = new Panels();
	this.rows = new Rows();
}

// checks dir status for the dashboards
Dashboards.prototype.checkDirStatus = function(showOutput) {
	return localfs.checkExists(dashDir, 'dashboards directory', showOutput) && this.tempVars.checkDirStatus(showOutput) && 
		this.panels.checkDirStatus(showOutput) &&
		this.rows.checkDirStatus(showOutput);
};

// summarize dashboard
Dashboards.prototype.summarize = function(dashboardSlug) {
	var dashboard = this.readDashboard(dashboardSlug);
	var arch = {};

	// Extracting row information
	arch.title = dashboard.title;
	arch.rowCount = _.size(dashboard.rows);
	arch.rows = [];
	_.forEach(dashboard.rows, function(row) {

		var panelInfo = _.map(row.panels, function(panel) {
			return panel.title + '(' + panel.datasource + ')';
		});

		arch.rows.push({
  		title: row.title,
			panelCount: _.size(row.panels),
			panels: _.join(panelInfo, ', ')
		});
	});
	if ('templating' in dashboard) {
		arch.templateVariableCount = _.size(dashboard.templating.list);
		arch.templateValiableNames = _.join(_.map(dashboard.templating.list, 'name'), ', ');
	}
	arch.time = dashboard.time;
	arch.time.timezone = dashboard.timezone;
	logger.showOutput(logger.stringify(arch));
};

// Saving a dashboard file on disk
Dashboards.prototype.saveDashboard = function(slug, dashboard, showResult) {
	// we delete version when we import the dashboard... as version is maintained by Grafana
	delete dashboard.version;
	localfs.writeFile(getDashboardFile(slug), logger.stringify(dashboard, null, 2));
	if (showResult) {
		logger.showResult(slug + ' dashboard saved successfully under dashboards directory.');
	}
};

Dashboards.prototype.insert = function(type, entity, dashboard) {

	var destDashboardSlug = dashboard;
	var destDashboard = this.readDashboard(destDashboardSlug);

	if (type === 'temp-var') {
		var destTempVarList = destDashboard.templating.list;
		destTempVarList.push(this.tempVars.readTemplateVariable(entity));
		this.saveDashboard(destDashboardSlug, destDashboard, true);
		logger.showResult('Template variable ' + entity + ' inserted successfully.');
	} else if (type === 'row') {
		var destRows = destDashboard.rows;
		destRows.push(this.rows.readRow(entity));
		this.saveDashboard(destDashboardSlug, destDashboard, true);
		logger.showResult('Row ' + entity + ' inserted successfully.');
	} else if (type === 'panel') {
		
	}

};

Dashboards.prototype.extract = function(type, entity, dashboard) {

	var srcDashboard = this.readDashboard(dashboard);
	var srcRows;

	if (type === 'temp-var') {
		var srcTempVarList = srcDashboard.templating.list;
		var srcTempVarNumber = parseInt(entity);
		var srcTempVar = srcTempVarList[srcTempVarNumber-1];
		this.tempVars.saveTemplateVar(dashboard, srcTempVar, true);
		logger.showResult('Template variable ' + entity + ' extracted successfully.');
	} else if (type === 'row') {
		srcRows = srcDashboard.rows;
		var srcRowNumber = parseInt(entity);
		var srcRow = srcRows[srcRowNumber-1];
		this.rows.saveRow(dashboard + '-' + srcRowNumber, srcRow, true);
		logger.showResult('Row ' + entity + ' extracted successfully.');
	} else if (type === 'panel') {
		var srcEntity = entity.split('.');
		srcRows = srcDashboard.rows;
		var srcPanels = srcRows[srcEntity[0]-1].panels;
		var srcPanelNumber = parseInt(srcEntity[1]);
		var srcPanel = srcPanels[srcPanelNumber-1];
		this.panels.savePanel(dashboard + '-' + srcEntity[0] + '-' + srcEntity[1], srcPanel, true);
		logger.showResult('Panel ' + entity + ' extracted successfully.');
	}

};

Dashboards.prototype.change = function(entityValue, oldDatasource, newDatasource) {

	var dashboard = this.readDashboard(entityValue);
	var arch = {};
	// Extracting row information
	arch.title = dashboard.title;
	arch.rowCount = _.size(dashboard.rows);
	arch.rows = [];
	_.forEach(dashboard.rows, function(row) {
		_.forEach(row.panels,function(panel){
			if(panel.datasource === oldDatasource){
				panel.datasource = newDatasource;
			}
		});
	});
	this.saveDashboard(entityValue, dashboard, true);

};

// Reads dashboard json from file.
Dashboards.prototype.readDashboard = function(slug) {

	if (localfs.checkExists(getDashboardFile(slug))) {
		return JSON.parse(localfs.readFile(getDashboardFile(slug)));
	}
	else {
		logger.showError('Dashboard file ' + getDashboardFile(slug) + ' does not exist.');
		process.exit();
	}
	
};

// Get dashboard file name from slug
function getDashboardFile(slug) {
	return dashDir + '/' + slug + '.json';
}

module.exports = Dashboards;