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
// react plugin for creating charts
import ChartistGraph from "react-chartist";
// core components
import GridItem from "components/Grid/GridItem.js";
import GridContainer from "components/Grid/GridContainer.js";
import { DataTable } from 'react-data-components';
import Card from "components/Card1/Card.js";
import CardHeader from "components/Card1/CardHeader.js";
import CardBody from "components/Card1/CardBody.js";
import CardFooter from "components/Card1/CardFooter.js";
//import appsync graphql functions
import { listSites, getSite, issuesBySiteAreaStatus } from "graphql/queries";
import { Logger } from 'aws-amplify';
import configurations from 'variables/configurations'

import {
  last7DaysChart,
  last24HoursChart
} from "variables/charts.js";

import sendMetrics from "./sendMetrics";

const logger = new Logger(configurations.logger.name, configurations.logger.level);
var Chartist = require("chartist");
class Metrics extends Component {

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
      setOrder: 'asc',
      Order: 'asc',
      setOrderBy: 'calories',
      orderBy: 'calories',
      sumOfResolutionTimeIssues: 0,
      showMetrics: false
    };
  }

  async componentDidMount() {
    this.setState({ title: 'Metrics' });
    //Getting sites at page load
    this.getSites();
    //Sending page view to solutions metrics
    await sendMetrics({ 'pageView': '/metrics' })
  }

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
      if (sites.length === 1) {
        let selectedSite = []
        selectedSite["id"] = sites[0]['id']
        selectedSite["name"] = sites[0]['name']
        this.setState({
          selectedSite: selectedSite,
          siteSelected: true,
          showMetrics: false
        });
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
      showMetrics: false
    });
    this.getAreas(selectedSite)
  }

  // Gets site areas
  getAreas = async (selectedSite) => {
    try {
      //Graphql operation to get areas
      const siteId = selectedSite.id;
      const response = await API.graphql(graphqlOperation(getSite, { id: siteId }))
      let areas = response.data.getSite.area.items;
      // Adds visible key/value for filter
      if (areas.length === 1) {
        this.setState.areaSelected = true
        let selectedArea = []
        selectedArea["id"] = areas[0]['id']
        selectedArea["name"] = areas[0]['name']
        this.setState({
          selectedArea: selectedArea,
          areaSelected: true,
          issuesRetrieved: false,
          showMetrics: false
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
      logger.debug(error)
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
      issuesRetrieved: false,
      showMetrics: false
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
        if (issues[i]['status'] !== "closed" && issues[i]['status'] !== "rejected") {
          issues[i]['visible'] = true;
        }
      }

      //Sorts initially
      issues.sort((a, b) => a.status.localeCompare(b.created));
      this.setState({
        issues: issues,
        title: `Issues (${issues.length})`,
        showMetrics: false
      });
      this.getMetrics(issues)
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

  addHours(date, hours) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours() + hours,
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
  }

  getPreviousDays(date, day, hours, minutes, seconds, milliSeconds) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + day,
      hours,
      minutes,
      seconds,
      milliSeconds
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

  getMetrics(issues) {
    //TODO
    try {
      //Calculating the count of issues for the last 7 days
      var today = new Date();
      let last7DaysLabels = []
      let last7DaysDataInner = []
      let last7DaysData = []
      var yesterdayEndDate = new Date(today)
      var yesterdayEnd = this.addISOTimeOffset(new Date(today))
      var yesterdayStart = this.addISOTimeOffset(this.getPreviousDays(new Date(today), 0, 0, 0, 0, 0))
      var sumOfResolutionTimeIssues = 0
      for (let j = 1; j < 8; j++) {
        var last7DaysIssues1 = issues.filter(function (dayData) {
          return dayData.created > yesterdayStart
        });
        var last7DaysIssues = last7DaysIssues1.filter(function (dayData) {
          return dayData.created < yesterdayEnd
        });
        last7DaysDataInner.push(last7DaysIssues.length)
        var sumResolutionTime = last7DaysIssues.reduce(function (sumOfResolutionTime, issue) {
          if (issue.resolutionTime != null) {
            if (sumOfResolutionTime['total'] != null) {
              sumOfResolutionTime['total'] = sumOfResolutionTime['total'] + issue.resolutionTime
            } else {
              sumOfResolutionTime['total'] = 0
              sumOfResolutionTime['total'] = sumOfResolutionTime['total'] + issue.resolutionTime
            }
          }
          return sumOfResolutionTime
        }, {});
        if (sumResolutionTime['total'] != null) {
          sumOfResolutionTimeIssues = sumOfResolutionTimeIssues + sumResolutionTime['total']
        }
        var dateLabel = new Date(yesterdayEndDate).getDate()
        last7DaysLabels.push(dateLabel)
        yesterdayStart = this.addISOTimeOffset(this.getPreviousDays(new Date(today), -j, 0, 0, 0, 0))
        yesterdayEnd = this.addISOTimeOffset(this.getPreviousDays(new Date(today), -j, 23, 59, 59, 59))
        yesterdayEndDate = this.getPreviousDays(new Date(today), -j, 23, 59, 59, 59)
      }
      sumOfResolutionTimeIssues = this.secondsToHms(sumOfResolutionTimeIssues)
      last7DaysData.push(last7DaysDataInner.reverse())
      let last7Days = {
        labels: last7DaysLabels.reverse(),
        series: last7DaysData
      }

      let last7DaysOptions = {
        lineSmooth: Chartist.Interpolation.cardinal({
          tension: 0
        }),
        low: 0,
        showArea: true,
        high: Math.max(...last7DaysDataInner) + 0.1 * Math.max(...last7DaysDataInner),
        chartPadding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      }

      //Calculating the count of issues for the last 24 hours
      let last24HoursEndDate = new Date(today)
      var last24HoursStartDate = this.addHours(new Date(today), -3)
      let last24HoursLabels = []
      let last24HoursDataInner = []
      let last24HoursData = []
      var last24HoursEnd = this.addISOTimeOffset(last24HoursEndDate)
      var last24HoursStart
      for (let j = 0; j < 9; j++) {
        last24HoursStart = this.addISOTimeOffset(new Date(last24HoursStartDate))
        var last24HoursIssues1 = issues.filter(function (threeHours) {
          return threeHours.created > last24HoursStart
        });
        var last24HoursIssues = last24HoursIssues1.filter(function (threeHours) {
          return threeHours.created < last24HoursEnd
        });
        last24HoursDataInner.push(last24HoursIssues.length)

        var hour = new Date(last24HoursEndDate).getHours()
        var convertedHour = hour % 12 || 12;
        var ampm = (hour < 12 || hour === 24) ? "AM" : "PM";
        var convertedLabel = convertedHour + ampm
        last24HoursLabels.push(convertedLabel)
        last24HoursEndDate = new Date(last24HoursStartDate)
        last24HoursEnd = this.addISOTimeOffset(new Date(last24HoursEndDate))
        last24HoursStartDate = this.addHours(new Date(last24HoursStartDate), -3)
      }
      last24HoursData.push(last24HoursDataInner.reverse())
      //Setting paramters to populate data on graph for last 24 hours
      let last24Hours = {
        labels: last24HoursLabels.reverse(),
        series: last24HoursData
      }
      let last24HoursOptions = {
        lineSmooth: Chartist.Interpolation.cardinal({
          tension: 0
        }),
        low: 0,
        showArea: true,
        high: Math.max(...last24HoursDataInner) + 0.1 * Math.max(...last24HoursDataInner),
        chartPadding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      }

      //Getting top number of issues
      var countedIssues = issues.reduce(function (allIssues, issue) {
        let processEventName = issue.processName + "#" + issue.eventDescription
        if (processEventName in allIssues) {
          allIssues[processEventName]++;
        }
        else {
          allIssues[processEventName] = 1;
        }
        return allIssues;
      }, {});
      issues.sort((a, b) => a.status.localeCompare(b.status));
      //Getting average resolution time for issues
      var avgResolutionTimeIssues = issues.reduce(function (allIssues, issue) {
        let processEventName = issue.processName + "#" + issue.eventDescription
        if (processEventName in countedIssues) {
          if (processEventName in allIssues) {
            allIssues[processEventName] = ((allIssues[processEventName] + issue.resolutionTime) / 2)
          }
          else {
            allIssues[processEventName] = issue.resolutionTime;
          }
        }
        return allIssues;
      }, {});
      //Merging the arrays to create list of occuring issues
      let key, key1;
      let result = []
      for (key in countedIssues) {
        let temp = {}
        let processEventArray = key.split('#')
        temp['processName'] = processEventArray[0]
        temp['issueDescription'] = processEventArray[1]
        temp['count'] = countedIssues[key]
        for (key1 in avgResolutionTimeIssues) {
          if (avgResolutionTimeIssues.hasOwnProperty(key1) && key == key1) {
            temp['avgResolutionTime'] = this.secondsToHms(avgResolutionTimeIssues[key1])
          }
        }
        result = result.concat(temp)
      }
      this.setState({
        topIssues: result,
        last24Hours: last24Hours,
        last24HoursOptions: last24HoursOptions,
        last7Days: last7Days,
        last7DaysOptions: last7DaysOptions,
        showMetrics: true,
        sumOfResolutionTimeIssues: sumOfResolutionTimeIssues
      });
    } catch (error) {
      logger.debug(error)
    }


  }

  render() {
    const { sites, areas, topIssues, last24Hours, last24HoursOptions, last7Days, last7DaysOptions, showMetrics, sumOfResolutionTimeIssues } = this.state
    const columns = [
      { title: 'Event Description', prop: 'issueDescription' },
      { title: 'Process Name', prop: 'processName' },
      { title: 'Number of issues', prop: 'count' },
      { title: 'Average Resolution Time', prop: 'avgResolutionTime' }
    ];
    return (
      <div id="RegistrationDiv">
        <GridContainer >

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
        {
          showMetrics &&
          <GridContainer>
            <GridItem xs={12} sm={12} md={6}>
              <Card chart>
                <CardHeader color="success">
                  <ChartistGraph
                    className="ct-chart"
                    data={last7Days} type="Bar"
                    options={last7DaysOptions}
                    listener={last7DaysChart.animation}
                  />
                </CardHeader>
                <CardBody>
                  <h4>Average number of issues per day (last 7 days)</h4>
                  <p></p>
                </CardBody>
                <CardFooter chart>
                </CardFooter>
              </Card>
            </GridItem>
            <GridItem xs={12} sm={12} md={6}>
              <Card chart>
                <CardHeader color="danger">
                  <ChartistGraph
                    className="ct-chart"
                    data={last24Hours}
                    type="Line"
                    options={last24HoursOptions}
                    listener={last24HoursChart.animation}
                  />
                </CardHeader>
                <CardBody>
                  <h4>Average number of issues per 3 hours (last 24 hours)</h4>
                  <p></p>
                </CardBody>
                <CardFooter chart>
                </CardFooter>
              </Card>
            </GridItem>
          </GridContainer>
        }
        {
          showMetrics && sumOfResolutionTimeIssues !== "" &&
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <Card>
                <CardHeader color="danger">
                  <h1>{sumOfResolutionTimeIssues}</h1>
                </CardHeader>
                <CardBody>
                  <h4>Total downtime due to issues (last 7 days)</h4>
                </CardBody>
                <CardFooter chart>
                </CardFooter>
              </Card>
            </GridItem>
          </GridContainer>
        }
        {
          showMetrics &&
          <GridContainer>
            <GridItem xs={12} sm={12} md={12}>
              <Card>
                <CardHeader color="warning">
                  <h6>Top occuring issues (last 7 days)</h6>
                </CardHeader>
                <CardBody>
                  <DataTable
                    keys="issueDescription"
                    columns={columns}
                    responsive={true}
                    initialData={topIssues}
                    initialPageLength={5}
                    selectableRows
                    //sortIcon={<Icon>arrow_downward</Icon>}
                    initialSortBy={{ prop: 'count', order: 'descending' }}
                  />
                </CardBody>
              </Card>
            </GridItem>
          </GridContainer>
        }
      </div>
    );
  }
}
export default Metrics;