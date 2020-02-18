/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/*eslint-disable*/
import React, { Component, useState } from "react";
import { API, graphqlOperation } from "aws-amplify";
// core components
import GridItem from "components/Grid/GridItem.js";
import GridContainer from "components/Grid/GridContainer.js";
//import Button from "components/CustomButtons/Button.js";
import Card from "components/Card1/Card.js";
import CardBody from "components/Card1/CardBody.js";
import CardHeader from "components/Card1/CardHeader.js";
//import appsync graphql functions
import { listSites, getSite, issuesBySiteAreaStatus } from "graphql/queries";
import { onCreateIssue, onUpdateIssue } from "graphql/subscriptions";
//import History Table components
import { DataTable } from 'react-data-components';
//import { FontIcon } from 'react-md';
import { Logger } from 'aws-amplify';
import { CSVLink, CSVDownload } from "react-csv";
import sendMetrics from "./sendMetrics";
import configurations from 'variables/configurations'

const logger = new Logger(configurations.logger.name, configurations.logger.level);

class History extends Component {
  //classes = useStyles();
  constructor(props) {
    super(props);
    // Sets up initial state
    this.state = {
      issues: [],
      sites: [],
      areas: [],
      selectedSite: [],
      selectedArea: [],
      siteSelected: false,
      areaSelected: false,
      showHistory: false
    };
  }

  componentDidMount() {
    this.setState({ title: 'Observer' });

    //Sending page view to solutions metrics
    sendMetrics({ 'pageView': '/history' }).then((data) => { 'metrics sent successfully' }, (error) => { logger.error(error) })

    //Getting sites at page load
    this.getSites();

    //Subscribing to new issues
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response) => {
        let newIssues = response.value.data.onCreateIssue;
        // // Adds visible key/value for filter
        if (newIssues['status'] == "open" || newIssues['status'] == "acknowledged") {
          newIssues['visible'] = true;
        } else {
          newIssues['visible'] = false;
        }
        let issues = this.state.issues.concat(newIssues);
        this.setState({
          issues: issues,
          title: `Issues (${issues.length})`,
        });
      }
    })
    //Subscribing to update issues
    this.updateIssuesubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
      next: (response) => {
        let updatedIssues = response.value.data.onUpdateIssue;
        const { issues } = this.state
        // // Adds visible key/value for filter
        if (updatedIssues['status'] == "open") {
          updatedIssues['visible'] = true;
        } else {
          //this.state.issues.delete(updatedIssues['id'])
        }
        for (let i = 0; i < issues.length; i++) {
          if (issues[i]['id'] == updatedIssues['id']) {
            if (updatedIssues['status'] == "closed" || updatedIssues['status'] == 'rejected') {
              issues[i]['resolutionTime'] = updatedIssues['resolutionTime'];
              issues[i]['status'] = updatedIssues['status'];
              issues[i]['closed'] = updatedIssues['closed'];
              issues[i]['visible'] = updatedIssues['visible'];
            }
          }
        }
        this.setState({
          issues: issues,
          title: `Issues (${issues.length})`,
        });
      }
    })
  }

  componentWillUnmount() {
    this.updateIssuesubscription.unsubscribe();
    this.createIssueSubscription.unsubscribe();
  }

  // Sorts sites
  sortSites = (order) => {
    let sites = this.state.sites;
    if (order === 'asc') {
      sites.sort((a, b) => a.attributes.siteName.localeCompare(b.attributes.siteName));
    } else if (order === 'desc') {
      sites.sort((a, b) => b.attributes.siteName.localeCompare(a.attributes.siteName));
    }

    this.setState({ sites: sites });
  };

  // Gets sites
  getSites = async () => {
    try {
      this.setState({ isLoading: true });
      //Graphql operation to get sites
      const response = await API.graphql(graphqlOperation(listSites))
      let sites = response.data.listSites.items;
      if (response.data.listSites.nextToken != null) {
        let nextToken = response.data.listSites.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(listSites, { nextToken: nextToken }))
          sites = sites.concat(response1.data.listSites.items);
          nextToken = response1.data.listSites.nextToken;
        }
      }

      if (sites.length == 1) {
        let selectedSite = []
        selectedSite["id"] = sites[0]['id']
        selectedSite["name"] = sites[0]['name']
        this.setState.selectedSite = selectedSite
        this.setState.siteSelected = true
        this.getAreas(selectedSite)
      }
      // Adds visible key/value for filter
      for (let i = 0; i < sites.length; i++) {
        sites[i]['visible'] = true;
      }
      // Sorts initially
      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        sites: sites
      });
    } catch (error) {
      logger.error(error)
      let message = error.response;
      if (message === undefined) {
        message = error.message;
      } else {
        message = error.response.data.message;
      }

      this.setState({ error: message, });
    }
    this.setState({ isLoading: false, });
  }

  //Function called when a site is selected
  selectSite = async () => {
    const selectedIndex = event.target.options.selectedIndex;
    let selectedSite = {}
    selectedSite["id"] = event.target.options[selectedIndex].getAttribute('data-key')
    selectedSite["name"] = event.target.options[selectedIndex].getAttribute('value')
    this.setState({
      selectedSite: selectedSite,
      siteSelected: true,
      areaSelected: false,
      showHistory: false
    });
    this.getAreas(selectedSite)
  }

  // Gets site areas
  getAreas = async (selectedSite) => {
    try {
      const siteId = selectedSite.id;
      //this.setState({ siteId })
      this.setState({
        selectedSite: selectedSite,
        siteSelected: true,
        siteId: siteId
      });
      const response = await API.graphql(graphqlOperation(getSite, { id: siteId }))
      let areas = response.data.getSite.area.items;
      // Adds visible key/value for filter
      if (areas.length == 1) {
        this.setState.areaSelected = true
        let selectedArea = []
        selectedArea["id"] = areas[0]['id']
        selectedArea["name"] = areas[0]['name']
        this.setState.selectedArea = selectedArea
        this.setState({
          selectedArea: selectedArea,
          areaSelected: true
        });
        this.getIssues(selectedSite, selectedArea)

      }
      for (let i = 0; i < areas.length; i++) {
        areas[i]['visible'] = true;
      }
      // Sorts initially
      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        areas: areas
      });
    }
    catch (error) {
      logger.error(error)
      let message = error.response;
      if (message === undefined) {
        message = error.message;
      } else {
        message = error.response.data.message;
      }
      this.setState({ error: message, });
    }
    this.setState({ isLoading: false, });
  }
  //Function called when a area is selected
  selectArea = async () => {
    const { selectedSite } = this.state
    const selectedIndex = event.target.options.selectedIndex;
    let selectedArea = {}
    selectedArea["id"] = event.target.options[selectedIndex].getAttribute('data-key')
    selectedArea["name"] = event.target.options[selectedIndex].getAttribute('value')
    this.setState({
      selectedArea: selectedArea,
      areaSelected: true,
      showHistory: false
    });
    this.getIssues(selectedSite, selectedArea)
  }

  addDays(date, days) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + days,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
  }

  addISOTimeOffset(date) {
    var isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    return isoDate
  }

  secondsToHms(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
  }


  getIssues = async (selectedSite, selectedArea) => {
    try {
      //Graphql operation to get issues
      const selectedSiteName = selectedSite.name;
      const selectedAreaName = selectedArea.name;
      const lastWeek = this.addDays(new Date(), -7)
      const response = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName } },
        filter: { created: { gt: this.addISOTimeOffset(new Date(lastWeek)) } },
        limit: 40

      }))
      let issues
      issues = response.data.issuesBySiteAreaStatus.items;
      if (response.data.issuesBySiteAreaStatus.nextToken != null) {
        let nextToken = response.data.issuesBySiteAreaStatus.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
            siteName: selectedSiteName,
            areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName } },
            filter: { created: { gt: this.addISOTimeOffset(new Date(lastWeek)) } },
            limit: 40,
            nextToken: nextToken
          }))
          issues = issues.concat(response1.data.issuesBySiteAreaStatus.items);
          nextToken = response1.data.issuesBySiteAreaStatus.nextToken;
        }
      }
      // Adds visible key/value for filter
      for (let i = 0; i < issues.length; i++) {
        if (issues[i]['status'] != "closed" && issues[i]['status'] != "rejected") {
          issues[i]['visible'] = true;
        }
        //issues[i]['resolutionTime'] = this.secondsToHms(issues[i]['resolutionTime'])

      }
      //Sorts initially
      issues.sort((a, b) => a.status.localeCompare(b.created));
      this.setState({
        issues: issues,
        title: `Issues (${issues.length})`,
        showHistory: true
      });

    } catch (error) {
      logger.error(error)
      let message = error.response;
      if (message === undefined) {
        message = error.message;
      } else {
        message = error.response.data.message;
      }

      this.setState({ error: message, });
    }

    this.setState({ isLoading: false, });

  }

  render() {
    const { issues, sites, areas, showHistory } = this.state
    const columns = [
      { title: 'Event Description', prop: 'eventDescription' },
      { title: 'Process Name', prop: 'processName' },
      { title: 'Device Name', prop: 'deviceName' },
      { title: 'Status', prop: 'status' },
      { title: 'Timestamp', prop: 'created' },
      { title: 'Closed Timestamp', prop: 'closed' },
      { title: 'Resolution Time (sec)', prop: 'resolutionTime' }
    ];
    var csvFileName = "issues-" + new Date().getTime() + ".csv"
    const data = issues;
    return (
      <div id="RegistrationDiv">
        <GridContainer>

          {
            sites.length > 1 &&
            <GridItem xs={12} sm={6} md={6}>
              <div>
                <p><b>Select site</b></p>
                <p>Select the site for which you want to view the issues</p>
                <select name="Sites" onChange={() => this.selectSite()} defaultValue="Choose site">
                  <option value="Choose site" disabled hidden>Choose site</option>
                  {
                    sites
                      .filter(site => site.visible)
                      .map(site => {
                        return (
                          <option data-key={site.id} key={site.name} value={site.name}>{site.name}</option>
                        )
                      }
                      )
                  }
                </select>
              </div>
            </GridItem>
          }
          {
            sites.length == 1 &&
            <GridItem xs={12} sm={6} md={6}>
              <div>
                <p><b>Site Name</b></p>
                <p>{sites[0].name}</p>
              </div>
            </GridItem>
          }
          {
            areas.length > 1 &&
            <GridItem xs={12} sm={6} md={6}>
              <div>
                <p><b>Select work area</b></p>
                <p>Select the work area for which you want to view the issues</p>
                <select name="Areas" onChange={() => this.selectArea()} defaultValue="Choose area">
                  <option value="Choose area" disabled hidden>Choose area</option>
                  {
                    areas
                      .filter(area => area.visible)
                      .map(area => {
                        return (
                          <option data-key={area.id} key={area.name} value={area.name}>{area.name}</option>
                        )
                      }
                      )
                  }
                </select>
              </div>
            </GridItem>
          }
          {
            areas.length == 1 &&
            <GridItem xs={12} sm={6} md={6}>
              <div>
                <p><b>Work area</b></p>
                <p>Selected work area</p>
                <p><b>{areas[0].name}</b></p>
              </div>
            </GridItem>
          }


        </GridContainer>

        <Card>
          <CardBody>
            <GridContainer>
              {
                data.length == 0 &&
                <GridItem xs={12} sm={12} md={12}>
                  <Card>
                    <CardBody>
                      <h3 align="center">No issues found in the last 7 days. Please select a site / area if you have multiple to display relevant history</h3>
                      <br />
                    </CardBody>
                  </Card>
                </GridItem>
              }

              {
                showHistory && data.length > 0 &&
                <GridItem xs={12} sm={12} md={12}>
                  <Card>
                    <CardHeader color="warning">
                      <h6>History (last 7 days)</h6>
                    </CardHeader>
                    <CardBody>
                      <div align="right">
                        <CSVLink data={data} target="_blank" className="btn btn-primary" filename={csvFileName}>
                          Download CSV file of issues
                  </CSVLink>
                      </div>
                      <DataTable
                        keys="created"
                        columns={columns}
                        responsive={true}
                        initialData={data}
                        initialPageLength={20}
                        selectableRows
                        //sortIcon={<Icon>arrow_downward</Icon>}
                        initialSortBy={{ prop: 'closed', order: 'descending' }}
                      />
                    </CardBody>
                  </Card>
                </GridItem>
              }
            </GridContainer>
          </CardBody>
        </Card>
      </div>
    )
  }
}
export default History;