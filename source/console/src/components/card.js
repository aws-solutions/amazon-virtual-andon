/*eslint-disable*/
import React from "react";
import Amplify, { PubSub } from 'aws-amplify';
import { AWSIoTProvider } from '@aws-amplify/pubsub/lib/Providers';
import Auth from "@aws-amplify/auth";
import axios from "axios";
const uuidv1 = require('uuid/v1');
import { Logger } from 'aws-amplify';

declare var andon_config;
const logger = new Logger('Andon', 'INFO');

Amplify.addPluggable(new AWSIoTProvider({
  aws_pubsub_region: andon_config.aws_project_region,
  aws_pubsub_endpoint: andon_config.aws_iot_endpoint + '/mqtt'
}));

class Card extends React.Component {
  constructor(props) {
    super(props);
    this.state = { x: 0, y: 0 };
    this.baseUrl = props.baseUrl;
    this.handleClick = this.handleClick.bind(this);
    this.sendRequest = this.sendRequest.bind(this);
  }

  addISOTimeOffset(date) {
    var isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    return isoDate
  }

  sendRequest(issueDetails, selectedEvent, issueName, uniqueId, updatedIssue) {
    let status
    let issueToPublish
    if (!selectedEvent.isActive) {
      const id = uuidv1();
      issueToPublish = {
        id: id,
        eventDescription: selectedEvent.name,
        type: selectedEvent.type,
        priority: selectedEvent.priority,
        siteName: issueDetails.selectedSite.name,
        processName: issueDetails.selectedProcess.name,
        areaName: issueDetails.selectedArea.name,
        stationName: issueDetails.selectedStation.name,
        deviceName: issueDetails.selectedDevice.name,
        created: this.addISOTimeOffset(new Date()),
        status: "open"
      }
      status = "open"
      //send solution anonymous metrics
      if (andon_config.solutions_send_metrics === 'true') {
        axios.post(andon_config.solutions_metrics_endpoint, {
          Data: {
            Issue: 1,
            Version: andon_config.solutions_version,
            Region: andon_config.aws_project_region,
          },
          Solution: andon_config.solutions_solutionId,
          Timestamp: `${new Date().toISOString().replace(/T/, ' ')}`,
          UUID: andon_config.solutions_solutionUuId,
        }, {
          headers: { 'Content-Type': 'application/json' }
        }).then((data) => { 'metrics sent successfully' }, (error) => { logger.error(error) })
      }
    } else {
      let issueClosedTimestamp = this.addISOTimeOffset(new Date())
      let resolutionTime = Math.ceil((new Date(issueClosedTimestamp) - new Date(selectedEvent.createIssueTime)) / 1000)
      issueToPublish = {
        id: selectedEvent.activeIssueId,
        eventDescription: selectedEvent.name,
        type: selectedEvent.type,
        priority: selectedEvent.priority,
        siteName: issueDetails.selectedSite.name,
        processName: issueDetails.selectedProcess.name,
        areaName: issueDetails.selectedArea.name,
        stationName: issueDetails.selectedStation.name,
        deviceName: issueDetails.selectedDevice.name,
        created: selectedEvent.createIssueTime,
        closed: issueClosedTimestamp,
        resolutionTime: resolutionTime,
        status: "closed",
        expectedVersion: selectedEvent.updateIssueVersion
      }
      status = "closed"
    }
    this.publishToTopic(issueToPublish)
    this.updateCardColor(uniqueId, selectedEvent.priority, status)
  };

  updateCardColor(uniqueId, issuePriority, status) {
    if (status === "open") {
      document.getElementById(uniqueId).style.backgroundColor = "#ff6961"
    } else if (status === "acknowledged") {
      document.getElementById(uniqueId).style.backgroundColor = "#fdfd96"
    } else if (status === "closed") {
      document.getElementById(uniqueId).style.backgroundColor = "#33cc33"
    }

  }

  handleClick() {
    this.sendRequest(this.props.issueDetails, this.props.selectedEvent, this.props.issueName, this.props.uniqueId, this.props.updatedIssue)
  }

  publishToTopic = async (issueToPublish) => {
    try {
      await PubSub.publish('ava/issues', issueToPublish);
    } catch (error) {
      console.log(error)
    }
  }

  interfaceUpdaterDrawer() {
    let tempEvent = this.props.selectedEvent
    let uniqueId = this.props.uniqueId
    if (tempEvent.isOpen) {
      document.getElementById(uniqueId).style.backgroundColor = "#ff6961"
    } else if (tempEvent.isAcknowledged) {
      document.getElementById(uniqueId).style.backgroundColor = "#fdfd96"
    } else if (tempEvent.isClosedRejected) {
      if (document.getElementById(uniqueId).style.backgroundColor !== "rgb(233, 233, 233)") {
        document.getElementById(uniqueId).style.backgroundColor = "#33cc33"
        var delayInMilliseconds = 500; //0.5 second
        setTimeout(function () {
          document.getElementById(uniqueId).style.backgroundColor = "#e9e9e9"
        }, delayInMilliseconds);
      }
    }
  }


  //After each card is loaded, we call the function interfaceUpdateDrawer to update the color.
  componentDidUpdate() {
    this.interfaceUpdaterDrawer()
  }

  componentDidMount() {

  }

  render() {
    return (
      <a onClick={this.handleClick}>
        <div className="clientcard" id={this.props.uniqueId}>
          <img className="img" src={this.props.imagepath} alt="" />
          <p className="helvetica-text">{this.props.textToShow}</p>
          <p className="helvetica-text">{this.props.Ack}</p>
        </div>
      </a>
    );
  }
};

export default Card;