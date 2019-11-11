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
import React, { Component } from 'react';
import { API, graphqlOperation } from "aws-amplify";
// core components
import GridItem from "components/Grid/GridItem.js";
import GridContainer from "components/Grid/GridContainer.js";
import Event from '../components/card.js';
import Card from "components/Card1/Card.js";
import CardBody from "components/Card1/CardBody.js";
//import appsync graphql functions
import { listSites, getSite, issuesByDevice, getArea, getStation, getProcess } from "graphql/queries";
import { onCreateIssue, onUpdateIssue } from "graphql/subscriptions";
import './app.css';
import { Logger } from 'aws-amplify';
import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);
import sendMetrics from "./sendMetrics";

class Client extends Component {
  constructor(props) {
    super(props);
    // Sets up initial state
    this.state = {
      issues: [],
      sites: [],
      areas: [],
      process: [],
      station: [],
      device: [],
      events: [],
      selectedSite: [],
      selectedArea: [],
      selectedDevice: [],
      selectedProcess: [],
      selectedStation: [],
      siteSelected: false,
      areaSelected: false,
      showEvents: false,
      processSelected: false,
      stationSelected: false,
      deviceSelected: false,
      updatedIssue: []
    };
    //Sending page view to solutions metrics
    sendMetrics({ 'pageView': '/client' }).then((data) => { 'metrics sent successfully' }, (error) => { logger.error(error) })

    //Getting issues at page load
    this.getSites();
    //Subscribing to new issues
    this.createIssueSubscription = API.graphql(graphqlOperation(onCreateIssue)).subscribe({
      next: (response) => {
        let newIssues = response.value.data.onCreateIssue;
        const { deviceSelected } = this.state
        // // Adds visible key/value for filter
        if (newIssues['status'] == "open" || newIssues['status'] == "acknowledged") {
          newIssues['visible'] = true;
        } else {
          newIssues['visible'] = false;
        }
        let { events, selectedArea, selectedSite, selectedProcess, selectedDevice, selectedStation } = this.state
        if (deviceSelected && selectedSite.name == newIssues['siteName'] && selectedArea.name == newIssues['areaName'] &&
          selectedStation.name == newIssues['stationName'] && selectedDevice.name == newIssues['deviceName'] && selectedProcess.name == newIssues['processName']) {
          for (let i = 0; i < events.length; i++) {
            if (events[i]['name'] == newIssues['eventDescription']) {
              events[i]['isActive'] = true
              events[i]['activeIssueId'] = newIssues['id']
              events[i]['updateIssueVersion'] = newIssues['version']
              events[i]['createIssueTime'] = newIssues['created']
              if (newIssues['status'] == "acknowledged") {
                events[i]['isAcknowledged'] = true
                events[i]['isOpen'] = false
                events[i]['isClosedRejected'] = false
              } else if (newIssues['status'] == "open") {
                events[i]['isOpen'] = true
                events[i]['isAcknowledged'] = false
                events[i]['isClosedRejected'] = false
              }
            }
          }
        }
        let issues = this.state.issues.concat(newIssues);
        this.setState({
          issues: issues,
          title: `Issues (${issues.length})`,
          updatedIssue: [],
          events: events
        });
      }
    })
    //Subscribing to update issues
    this.updateIssuesubscription = API.graphql(graphqlOperation(onUpdateIssue)).subscribe({
      next: (response) => {
        let updatedIssues = response.value.data.onUpdateIssue;
        const { events, selectedArea, selectedSite, selectedProcess, selectedDevice, selectedStation } = this.state
        // // Adds visible key/value for filter
        if (selectedSite.name == updatedIssues['siteName'] && selectedArea.name == updatedIssues['areaName'] &&
          selectedStation.name == updatedIssues['stationName'] && selectedDevice.name == updatedIssues['deviceName'] && selectedProcess.name == updatedIssues['processName']) {
          if (updatedIssues['status'] == "closed" || updatedIssues['status'] == "rejected") {
            for (let i = 0; i < events.length; i++) {
              if (events[i]['name'] == updatedIssues['eventDescription']) {
                events[i]['isActive'] = false
                events[i]['isAcknowledged'] = false
                events[i]['isClosedRejected'] = true
                events[i]['activeIssueId'] = ""
                events[i]['isAcknowledged'] = false
                events[i]['isOpen'] = false
              }
            }
          } else if (updatedIssues['status'] == "acknowledged") {
            for (let i = 0; i < events.length; i++) {
              if (events[i]['name'] == updatedIssues['eventDescription']) {
                events[i]['updateIssueVersion'] = updatedIssues['version']
                events[i]['createIssueTime'] = updatedIssues['created']
                events[i]['isAcknowledged'] = true
                events[i]['isOpen'] = false
              }
            }
          }
        }
        let issues = this.state.issues.concat(updatedIssues);
        this.setState({
          events: events,
          issues: issues,
          updatedIssue: updatedIssues
        });
      }
    })
  }

  //Unsubscribe to subscriptions
  componentWillUnmount() {
    this.updateIssuesubscription.unsubscribe();
    this.createIssueSubscription.unsubscribe();
  }

  // Gets sites
  getSites = async () => {
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
        selectedSite["id"] = sites[0]['id']
        selectedSite["name"] = sites[0]['name']
        this.setState({
          selectedSite: selectedSite,
          siteSelected: true,
          selectedArea: [],
          selectedDevice: [],
          selectedProcess: [],
          selectedStation: [],
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
      showEvents: false,
      areaSelected: false,
      processSelected: false,
      deviceSelected: false,
      stationSelected: false,
      selectedArea: [],
      selectedDevice: [],
      selectedProcess: [],
      selectedStation: [],
      events: []
    });
    if (document.getElementById('Area') !== null) {
      document.getElementById('Area').value = "Choose area"
    }
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
        let selectedArea = []
        selectedArea["id"] = areas[0]['id']
        selectedArea["name"] = areas[0]['name']
        this.setState.selectedArea = selectedArea
        this.setState({
          selectedArea: selectedArea,
          areaSelected: true
        });
        this.getProcessesandStation(selectedArea)
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
    const selectedIndex = event.target.options.selectedIndex;
    let selectedArea = {}
    selectedArea["id"] = event.target.options[selectedIndex].getAttribute('data-key')
    selectedArea["name"] = event.target.options[selectedIndex].getAttribute('value')
    this.setState({
      selectedArea: selectedArea,
      areaSelected: true,
      showEvents: false,
      processSelected: false,
      deviceSelected: false,
      stationSelected: false,
      selectedDevice: [],
      selectedProcess: [],
      selectedStation: [],
      events: [],
      showEvents: false
    });
    if (document.getElementById('Process') !== null) {
      document.getElementById('Process').value = "Choose process"
    }
    this.getProcessesandStation(selectedArea);
  }

  getProcessesandStation = async (selectedArea) => {
    try {
      //Graphql operation to get processs
      const response = await API.graphql(graphqlOperation(getArea, { id: selectedArea.id }))
      let processes = response.data.getArea.process.items;
      if (response.data.getArea.process.nextToken != null) {
        let nextToken = response.data.getArea.process.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(getSite, { id: selectedArea.id, process: { nextToken: nextToken } }))
          processes = processes.concat(response1.data.getArea.process.items);
          nextToken = response1.data.getArea.process.nextToken;
        }
      }
      // Adds visible key/value for filter
      for (let i = 0; i < processes.length; i++) {
        processes[i]['visible'] = true;
      }
      // Sorts initially
      processes.sort((a, b) => a.name.localeCompare(b.name));
      if (processes.length == 1) {
        let selectedProcess = []
        selectedProcess["id"] = processes[0]['id']
        selectedProcess["name"] = processes[0]['name']
        this.setState({
          selectedProcess: selectedProcess,
          processSelected: true
        });
        this.getEvents(selectedProcess)
      }

      let station = response.data.getArea.station.items;
      if (response.data.getArea.station.nextToken != null) {
        let nextToken = response.data.getArea.station.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(getSite, { id: selectedArea.id, station: { nextToken: nextToken } }))
          station = station.concat(response1.data.getArea.station.items);
          nextToken = response1.data.getArea.station.nextToken;
        }
      }
      for (let i = 0; i < station.length; i++) {
        station[i]['visible'] = true;
      }
      // Sorts initially
      station.sort((a, b) => a.name.localeCompare(b.name));

      if (station.length == 1) {
        let selectedStation = []
        selectedStation["id"] = station[0]['id']
        selectedStation["name"] = station[0]['name']
        this.setState({
          selectedStation: selectedStation,
          stationSelected: true,
          deviceSelected: false,
          events: [],
          showEvents: false
        });
        this.getDevice(selectedStation)
      }

      this.setState({
        process: processes,
        title: `Processes (${processes.length})`,
        station: station,
        title: `Stations (${station.length})`
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

  selectProcess = async () => {
    const { station } = this.state
    const selectedIndex = event.target.options.selectedIndex;
    let selectedProcess = {}
    selectedProcess["id"] = event.target.options[selectedIndex].getAttribute('data-key')
    selectedProcess["name"] = event.target.options[selectedIndex].getAttribute('value')
    
    if (document.getElementById('Station') !== null) {
      document.getElementById('Station').value = "Choose station"
    }
    if(station.length > 1){
      this.setState({
        selectedProcess: selectedProcess,
        processSelected: true,
        showEvents: false,
        stationSelected: false,
        deviceSelected: false,
        showEvents: false,
        selectedDevice: [],
        selectedStation: [],
        station: station
      });
      this.getEvents(selectedProcess)
    } else if(station.length == 1) {
      this.setState({
        selectedProcess: selectedProcess,
        processSelected: true,
        stationSelected: true,
        deviceSelected: false,
        showEvents: false,
        selectedDevice: [],
        selectedStation: station[0],
        station: station
      });
    }
    
  }

  selectStation = async () => {
    try {
      const selectedIndex = event.target.options.selectedIndex;
      let selectedStation = {}
      selectedStation["id"] = event.target.options[selectedIndex].getAttribute('data-key')
      selectedStation["name"] = event.target.options[selectedIndex].getAttribute('value')
      this.setState({
        selectedStation: selectedStation,
        stationSelected: true,
        deviceSelected: false,
        events: [],
        showEvents: false
      });
      if (document.getElementById('Device') !== null) {
        document.getElementById('Device').value = "Choose device"
      }
      this.getDevice(selectedStation)
    } catch (error) {
      logger.error(error)
    }
  }

  getDevice = async (selectedStation) => {
    const { selectedProcess } = this.state
    try {
      //Graphql operation to get devices   
      const response = await API.graphql(graphqlOperation(getStation, { id: selectedStation.id }))
      let devices = response.data.getStation.device.items;
      // Adds visible key/value for filter
      for (let i = 0; i < devices.length; i++) {
        devices[i]['visible'] = true;
      }
      if (devices.length == 1) {
        this.setState({
          stationSelected: true,
          selectedDevice: devices[0],
          deviceSelected: true
        });
        this.getEvents(selectedProcess)
        this.getIssues(devices[0], selectedProcess)
      }
      // Sorts initially
      devices.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        device: devices,
        title: `Devices (${devices.length})`,
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
  }

  selectDevice = async () => {
    const { selectedProcess, selectedStation } = this.state
    const selectedIndex = event.target.options.selectedIndex;
    let selectedDevice = {}
    selectedDevice["id"] = event.target.options[selectedIndex].getAttribute('data-key')
    selectedDevice["name"] = event.target.options[selectedIndex].getAttribute('value')
    this.setState({
      selectedDevice: selectedDevice,
      stationSelected: true,
      deviceSelected: true,
      showEvents: true,
      events: []
    });
    this.getEvents(selectedProcess)
    this.getIssues(selectedDevice, selectedProcess)
  }

  getEvents = async (selectedProcess) => {
    try {
      //Graphql operation to get events
      const response = await API.graphql(graphqlOperation(getProcess, { id: selectedProcess.id }))
      let events = response.data.getProcess.event.items;
      // Adds visible key/value for filter
      for (let i = 0; i < events.length; i++) {
        events[i]['visible'] = true;
        events[i]['isActive'] = false
        events[i]['isAcknowledged'] = false
        events[i]['isOpen'] = false
      }
      // Sorts initially
      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        
        events: events,
        title: `Events (${events.length})`,
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
  }

  getIssues = async (selectedDevice, selectedProcess) => {
    try {
      //Graphql operation to get issues
      const { selectedSite, selectedArea, selectedStation } = this.state
      const selectedSiteName = selectedSite.name;
      const responseOpen = await API.graphql(graphqlOperation(issuesByDevice, {
        siteName: selectedSiteName,
        areaNameStatusProcessNameStationNameDeviceNameCreated: {
          beginsWith: {
            areaName: selectedArea.name, status: "open",
            processName: selectedProcess.name, stationName: selectedStation.name, deviceName: selectedDevice.name
          }
        },
        limit: 20
      }))
      const responseAck = await API.graphql(graphqlOperation(issuesByDevice, {
        siteName: selectedSiteName,
        areaNameStatusProcessNameStationNameDeviceNameCreated: {
          beginsWith: {
            areaName: selectedArea.name, status: "acknowledged",
            processName: selectedProcess.name, stationName: selectedStation.name, deviceName: selectedDevice.name
          }
        },
        limit: 20
      }))
      let issues
      issues = responseOpen.data.issuesByDevice.items;
      issues = issues.concat(responseAck.data.issuesByDevice.items);
      if (responseOpen.data.issuesByDevice.nextToken != null) {
        let nextToken = responseOpen.data.issuesByDevice.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(issuesByDevice, {
            siteName: selectedSiteName,
            areaNameStatusProcessNameStationNameDeviceNameCreated: {
              beginsWith: {
                areaName: selectedArea.name, status: "open",
                processName: selectedProcess.name, stationName: selectedStation.name, deviceName: selectedDevice.name
              }
            },
            limit: 20,
            nextToken: nextToken
          }))
          issues = issues.concat(response1.data.issuesByDevice.items);
          nextToken = response1.data.issuesByDevice.nextToken;
        }
      }

      if (responseAck.data.issuesByDevice.nextToken != null) {
        let nextToken = responseAck.data.issuesByDevice.nextToken;
        while (nextToken != null) {
          let response1 = await API.graphql(graphqlOperation(issuesByDevice, {
            siteName: selectedSiteName,
            areaNameStatusProcessNameStationNameDeviceNameCreated: {
              beginsWith: {
                areaName: selectedArea.name, status: "acknowledged",
                processName: selectedProcess.name, stationName: selectedStation.name, deviceName: selectedDevice.name
              }
            },
            limit: 20,
            nextToken: nextToken
          }))
          issues = issues.concat(response1.data.issuesByDevice.items);
          nextToken = response1.data.issuesByDevice.nextToken;
        }
      }
      // Adds visible key/value for filter
      for (let i = 0; i < issues.length; i++) {
        if (issues[i]['status'] != "closed" && issues[i]['status'] != "rejected") {
          issues[i]['visible'] = true;
        }

      }

      const { events } = this.state
      for (let i = 0; i < events.length; i++) {
        for (let j = 0; j < issues.length; j++) {
          if (selectedDevice.name == issues[j]['deviceName'] && events[i]['name'] == issues[j]['eventDescription']) {
            events[i]['isActive'] = true
            events[i]['activeIssueId'] = issues[j]['id']
            events[i]['updateIssueVersion'] = issues[j]['version']
            events[i]['createIssueTime'] = issues[j]['created']
            if (issues[j]['status'] == 'acknowledged') {
              events[i]['isAcknowledged'] = true
              events[i]['isClosedRejected'] = false
              events[i]['isOpen'] = false
            } else if (issues[j]['status'] == 'open') {
              events[i]['isOpen'] = true
              events[i]['isClosedRejected'] = false
              events[i]['isAcknowledged'] = false
            } else if (issues[j]['status'] == 'closed' || issues[j]['status'] == 'rejected') {
              events[i]['isActive'] = false
              events[i]['isAcknowledged'] = false
              events[i]['isOpen'] = false
              events[i]['isClosedRejected'] = true
            }
          }
        }
      }
      //Sorts initially
      issues.sort((a, b) => a.status.localeCompare(b.status));
      this.setState({
        issues: issues,
        title: `Issues (${issues.length})`,
        events: events,
        showEvents: true,
        updatedIssue: []
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
    const { issues, sites, areas, process, station, device, events, showEvents, updatedIssue } = this.state;
    const { stationSelected, siteSelected, processSelected, areaSelected, selectedStation } = this.state;
    let i = 0;
    //If the agent has logged in before, 
    return (
      <div id="RegistrationDiv">
        <GridContainer>
          <GridItem md={1}></GridItem>
          {
            sites.length > 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Site Name</b></p>
                <p>Select the site</p>
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
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Site Name</b></p>
                <p>{sites[0].name}</p>
              </div>
            </GridItem>
          }
          {
            siteSelected && areas.length > 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Work area</b></p>
                <p>Select work area</p>
                <select id="Area" name="Areas" onChange={() => this.selectArea()} defaultValue="Choose area">
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
            siteSelected && areas.length == 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Work area</b></p>
                <p>Selected work area</p>
                <p><b>{areas[0].name}</b></p>
              </div>
            </GridItem>
          }
          {
            areaSelected && process.length > 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Process name</b></p>
                <p>Select process</p>
                <select id="Process" name="Process" onChange={() => this.selectProcess()} defaultValue="Choose process">
                  <option value="Choose process" disabled hidden>Choose process</option>
                  {
                    process
                      .filter(process => process.visible)
                      .map(process => {
                        return (
                          <option data-key={process.id} key={process.name} value={process.name}>{process.name}</option>
                        )
                      }
                      )
                  }
                </select>
              </div>
            </GridItem>
          }
          {
            areaSelected && process.length == 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Process name</b></p>
                <p>Selected process</p>
                <p><b>{process[0].name}</b></p>
              </div>
            </GridItem>
          }
          {
            processSelected && station.length > 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Station name</b></p>
                <p>Select station</p>
                <select id="Station" name="Station" onChange={() => this.selectStation()} defaultValue="Choose station">
                  <option value="Choose station" disabled hidden>Choose station</option>
                  {
                    station
                      .filter(station => station.visible)
                      .map(station => {
                        return (
                          <option data-key={station.id} key={station.name} value={station.name}>{station.name}</option>
                        )
                      }
                      )
                  }
                </select>
              </div>
            </GridItem>
          }
          {
            processSelected && station.length == 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Station name</b></p>
                <p>Selected station</p>
                <p><b>{station[0].name}</b></p>
              </div>
            </GridItem>
          }
          {
            stationSelected && processSelected && device.length > 1 &&
            <GridItem xs={12} sm={3} md={2}>
              <div>
                <p><b>Device name</b></p>
                <p>Select device</p>
                <select id="Device" name="Device" onChange={() => this.selectDevice()} defaultValue="Choose device">
                  <option value="Choose device" disabled hidden>Choose device</option>
                  {
                    device
                      .filter(device => device.visible)
                      .map(device => {
                        return (
                          <option data-key={device.id} key={device.name} value={device.name}>{device.name}</option>
                        )
                      }
                      )
                  }
                </select>
              </div>
            </GridItem>
          }
          {
            stationSelected && processSelected && device.length == 1 &&
            <GridItem xs={6} sm={3} md={2}>
              <div>
                <p><b>Device name</b></p>
                <p>Selected device</p>
                <p><b>{device[0].name}</b></p>
              </div>
            </GridItem>
          }
        </GridContainer>
        {
          showEvents && events.length > 0 &&
          <Card>
            <CardBody>
              <GridContainer>
                {
                  events
                    .filter(events => events.visible)
                    .map(events => {
                      i++;
                      let uniqueId = "button" + i;
                      return (
                        <GridItem xs={6} sm={3} md={3} key={events.name}>
                          <Event updatedIssue={updatedIssue} issueList={issues} issueDetails={this.state} selectedEvent={events} issueName={events.name} textToShow={events.name} uniqueId={uniqueId} />
                        </GridItem>
                      )
                    }
                    )
                }
              </GridContainer>
            </CardBody>
          </Card>
        }
        {
          showEvents && events.length == 0 &&
          <GridItem xs={12} sm={12} md={12}>
            <Card>
              <CardBody>
                <h3 align="center">No events found for the selected process. Please contact your administrator</h3>
                <br />
              </CardBody>
            </Card>
          </GridItem>
        }
      </div>
    );
  }
}
export default Client;