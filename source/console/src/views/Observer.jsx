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
import React, { Component } from "react";
import { API, graphqlOperation } from "aws-amplify";
// core components
import GridItem from "components/Grid/GridItem.js";
import GridContainer from "components/Grid/GridContainer.js";
import Card from "components/Card1/Card.js";
import CardHeader from "components/Card1/CardHeader.js";
import CardBody from "components/Card1/CardBody.js";
import {
  Button
} from 'react-bootstrap';
//import appsync graphql functions
import { listSites, getSite, issuesBySiteAreaStatus } from "graphql/queries";
import { onCreateIssue, onUpdateIssue } from "graphql/subscriptions";
import { updateIssue } from "graphql/mutations";
import { Logger } from 'aws-amplify';
import sendMetrics from "./sendMetrics";

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);


class Observer extends Component {
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
      issuesRetrieved: false
    };
  }

  async componentDidMount() {
    this.setState({ title: 'Observer' });
    //Sending page view to solutions metrics
    await sendMetrics({ 'pageView': '/observer' })

    //Getting issues at page load
    this.getSites();

    //Subscribing to new issues
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response) => {
        let newIssues = response.value.data.onCreateIssue;
        const { selectedSite, selectedArea, issuesRetrieved } = this.state
        // // Adds visible key/value for filter
        if (issuesRetrieved && selectedSite['name'] == newIssues['siteName'] && selectedArea['name'] == newIssues['areaName']) {
          if (newIssues['status'] == 'open' || newIssues['status'] == 'acknowledged') {
            let popUpMessage = "New issue was created at " + newIssues['deviceName']
            this.props.handleNotification(popUpMessage, 'success', 'pe-7s-close-circle', 5);
            newIssues['visible'] = true;
          } else {
            newIssues['visible'] = false;
          }
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

    //Subscribing to updated issues
    this.updateIssuesubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
      next: (response) => {
        let updatedIssues = response.value.data.onUpdateIssue;
        let issues = this.state.issues
        //Adds visible key/value for filter
        if (updatedIssues['status'] == 'open') {
          updatedIssues['visible'] = true;
        } else {
          updatedIssues['visible'] = false;
        }
        for (let i = 0; i < issues.length; i++) {
          if (issues[i]['id'] == updatedIssues['id']) {
            if (updatedIssues['status'] == "closed" || updatedIssues['status'] == 'rejected') {

              issues[i]['status'] = updatedIssues['status'];
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
    this.setState({ isLoading: true });
    try {
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
        selectedSite['id'] = sites[0]['id']
        selectedSite['name'] = sites[0]['name']
        this.setState.selectedSite = selectedSite
        this.setState.siteSelected = true
        this.getAreas(selectedSite)
        this.setState({
          selectedSite: selectedSite,
          siteSelected: true,
          areaSelected: false,
          issuesRetrieved: false
        });
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
      issuesRetrieved: false
    });
    this.getAreas(selectedSite)
  }

  // Gets site areas
  getAreas = async (selectedSite) => {
    try {
      //Graphql operation to get areas
      const siteId = selectedSite.id;
      this.setState({ siteId })
      const response = await API.graphql(graphqlOperation(getSite, { id: siteId }))
      let areas = response.data.getSite.area.items;
      // Adds visible key/value for filter
      if (areas.length == 1) {
        this.setState.areaSelected = true
        let selectedArea = []
        selectedArea['id'] = areas[0]['id']
        selectedArea['name'] = areas[0]['name']
        this.setState.selectedArea = selectedArea
        this.setState({
          areaSelected: true,
          issuesRetrieved: false,
          selectedArea: selectedArea
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
      issuesRetrieved: false
    });
    this.getIssues(selectedSite, selectedArea)
  }

  getIssues = async (selectedSite, selectedArea) => {
    try {
      //Graphql operation to get issues
      const selectedSiteName = selectedSite.name;
      const selectedAreaName = selectedArea.name;
      const responseOpen = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName, status: "open" } }, limit: 20
      }))
      const responseAck = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
        siteName: selectedSiteName,
        areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: { beginsWith: { areaName: selectedAreaName, status: "acknowledged" } }, limit: 20
      }))

      let issues = responseOpen.data.issuesBySiteAreaStatus.items;
      issues = issues.concat(responseAck.data.issuesBySiteAreaStatus.items);
      if (responseOpen.data.issuesBySiteAreaStatus.nextToken != null) {
        let nextToken = responseOpen.data.issuesBySiteAreaStatus.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
            siteName: selectedSiteName,
            areaNameProcessNameEventDescriptionStationNameDeviceNameStatusCreated: { beginsWith: { areaName: selectedAreaName, status: "open" } }, limit: 20, nextToken: nextToken
          }))
          issues = issues.concat(response1.data.issuesBySiteAreaStatus.items);
          nextToken = response1.data.issuesBySiteAreaStatus.nextToken;
        }
      } else {
        issues = responseOpen.data.issuesBySiteAreaStatus.items;
      }

      if (responseAck.data.issuesBySiteAreaStatus.nextToken != null) {
        let nextToken = responseAck.data.issuesBySiteAreaStatus.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(issuesBySiteAreaStatus, {
            siteName: selectedSiteName,
            areaNameProcessNameEventDescriptionStationNameDeviceNameStatusCreated: { beginsWith: { areaName: selectedAreaName, status: "acknowledged" } }, limit: 20, nextToken: nextToken
          }))
          issues = issues.concat(response1.data.issuesBySiteAreaStatus.items);
          nextToken = response1.data.issuesBySiteAreaStatus.nextToken;
        }
      } else {
        issues = issues.concat(responseAck.data.issuesBySiteAreaStatus.items);
      }
      // Adds visible key/value for filter
      for (let i = 0; i < issues.length; i++) {
        if (issues[i]['status'] != 'closed' && issues[i]['status'] != 'rejected') {
          issues[i]['visible'] = true;
        }

      }
      //Sorts initially
      issues.sort((a, b) => a.status.localeCompare(b.status));
      this.setState({
        issues: issues,
        title: `Issues (${issues.length})`,
        issuesRetrieved: true
      });
    } catch (error) {

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

  addISOTimeOffset(date) {
    var isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    return isoDate
  }

  updateIssue = async (issue, status) => {
    try {
      issue["status"] = status;
      issue["expectedVersion"] = issue["version"]
      const newVersion = issue["version"] + 1
      delete issue.version
      delete issue.visible
      delete issue.__typename

      if (status == "closed") {
        issue["closed"] = this.addISOTimeOffset(new Date());
        issue["resolutionTime"] = Math.ceil((new Date(issue["closed"]) - new Date(issue["created"])) / 1000)
      } else if (status == "acknowledged") {
        issue["acknowledged"] = this.addISOTimeOffset(new Date());
        issue["acknowledgedTime"] = Math.ceil((new Date(issue["acknowledged"]) - new Date(issue["created"])) / 1000)
      } else if (status == "rejected") {
        issue["closed"] = this.addISOTimeOffset(new Date());
        issue["resolutionTime"] = Math.ceil((new Date(issue["closed"]) - new Date(issue["created"])) / 1000)
      }

      const input = issue;
      await API.graphql(graphqlOperation(updateIssue, { input }))
      if (status == "closed") {
        this.props.handleNotification('Issue ' + issue.eventDescription + ' at ' + issue.deviceName + ' has been closed', 'success', 'pe-7s-close-circle', 3);
      } else if (status == "acknowledged") {
        this.props.handleNotification('Issue ' + issue.eventDescription + ' at ' + issue.deviceName + ' has been acknowledged', 'info', 'pe-7s-close-circle', 3);
      } else if (status == "rejected") {
        this.props.handleNotification('Issue ' + issue.eventDescription + ' at ' + issue.deviceName + ' has been rejected', 'info', 'pe-7s-close-circle', 3);
      }
      if (status != "rejected" && status != "closed") {
        issue.visible = true
      }
      issue.version = newVersion
    }
    catch (error) {

      this.props.handleNotification('Error occurred while updating the issue', 'error', 'pe-7s-close-circle', 5);
    }
    this.setState({
      isDeleting: false,
      show: false,
    });
  }

  render() {
    const { issues, sites, areas, areaSelected, issuesRetrieved } = this.state;
    return (
      <div id="RegistrationDiv">
        <GridContainer>

          {
            sites.length > 1 &&
            <GridItem xs={12} sm={6} md={6} key="grid1">
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
            <GridItem xs={12} sm={6} md={6} key="grid2">
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

        <GridContainer>
          {
            issues.length === 0 && areaSelected && issuesRetrieved &&
            <GridItem xs={12} sm={12} md={12}>
              <Card>
                <CardBody>
                  <h3 align="center">No issues open currently at this site / area</h3>
                  <br />
                </CardBody>
              </Card>
            </GridItem>
          }

          {
            issuesRetrieved && issues
              .filter(issues => issues.visible)
              .map(issues => {
                return (
                  <GridItem xs={6} sm={4} md={4} key={issues.id}>
                    <Card>
                      <CardHeader color="danger">
                        <p><b>{issues.eventDescription}</b></p>
                        <p>{issues.deviceName} - {issues.stationName}</p>
                      </CardHeader>
                      <CardBody>
                        <h6 >
                          Process Name - {issues.processName}
                        </h6>
                        {
                          issues.status == "open" &&
                          <Button className="btn-fill" bsSize="small" bsStyle="success" active color="success" onClick={() => this.updateIssue(issues, "acknowledged")}>Acknowledge</Button>
                        }
                        &nbsp;&nbsp;
                          {
                          issues.status == "acknowledged" &&
                          <Button className="btn-fill" bsSize="small" bsStyle="warning" active color="success" onClick={() => this.updateIssue(issues, "closed")}>Close</Button>
                        }
                        &nbsp;&nbsp;
                          {
                          issues.status == "open" &&
                          <Button className="btn-fill pull-right" bsSize="small" active onClick={() => this.updateIssue(issues, "rejected")}>Reject</Button>
                        }
                      </CardBody>
                    </Card>
                  </GridItem>
                )
              })
          }
        </GridContainer>
      </div>
    );
  }
}
export default Observer;