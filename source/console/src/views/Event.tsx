/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

// Import React, Amplify, and AWS SDK packages
import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation, I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';
import Auth from "@aws-amplify/auth";
import SNS from 'aws-sdk/clients/sns';

// MobX packages
import { observable } from 'mobx';
import { observer } from 'mobx-react';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Table from 'react-bootstrap/Table';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';

// Import graphql
import { getProcess } from '../graphql/queries';
import { createEvent, updateEvent } from '../graphql/mutations';
import { onCreateRootCause, onDeleteRootCause } from '../graphql/subscriptions';

// Import UUID
import * as uuid from 'uuid';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, validatePhoneNumber, validateEmailAddress, sortByName, getInputFormValidationClassName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IEvent, IEventUpdate, IRootCause } from '../components/Interfaces';
import { ModalType, EventPriority, SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
  match?: any;
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  title: string;
  events: IEvent[];
  rootCauses: IRootCause[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  rootCauseSearchKeyword: string;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  processId: string;
  processName: string;
  eventId: string;
  eventName: string;
  eventDescription: string;
  eventSms: string;
  eventEmail: string;
  eventPriority: EventPriority;
  eventType: string;
  eventTopicArn: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isEventNameValid: boolean;
  isEventDescriptionValid: boolean;
  isEventSmsValid: boolean;
  isEventEmailValid: boolean;
  isEventTypeValid: boolean;
  selectAllRootCauses: boolean;
}

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;

// Logging
const LOGGER = new Logger('Event', LOGGING_LEVEL);

/**
 * The event page
 * @class Event
 */
@observer
class Event extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create root cause subscription
  private createRootCauseSubscription: any;
  // Delete root cause subscription
  private deleteRootCauseSubscription: any;
  // The saved root causes would save the original state of queried root causes.
  private savedRootCauses: IRootCause[];
  // Root causes for events
  @observable private rootCauses: string[];

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: I18n.get('text.events'),
      rootCauses: [],
      events: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      rootCauseSearchKeyword: '',
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      processId: '',
      processName: '',
      eventId: '',
      eventName: '',
      eventDescription: '',
      eventSms: '',
      eventEmail: '',
      eventPriority: EventPriority.Low,
      eventType: '',
      eventTopicArn: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isEventNameValid: false,
      isEventDescriptionValid: false,
      isEventSmsValid: true,
      isEventEmailValid: true,
      isEventTypeValid: true,
      selectAllRootCauses: false
    };

    this.graphQlCommon = new GraphQLCommon();
    this.savedRootCauses = [];
    this.rootCauses = [];

    this.deleteEvent = this.deleteEvent.bind(this);
    this.addEvent = this.addEvent.bind(this);
    this.editEvent = this.editEvent.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleRootCauseSearchKeywordChange = this.handleRootCauseSearchKeywordChange.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleEventNameChange = this.handleEventNameChange.bind(this);
    this.handleEventDescriptionChange = this.handleEventDescriptionChange.bind(this);
    this.handleEventSmsChange = this.handleEventSmsChange.bind(this);
    this.handleEventEmailChange = this.handleEventEmailChange.bind(this);
    this.handleEventPriorityChange = this.handleEventPriorityChange.bind(this);
    this.handleEventTypeChange = this.handleEventTypeChange.bind(this);
    this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get process and root causes
    await this.getProcess();
    await this.getRootCauses();

    // Subscribe to create root cause
    this.createRootCauseSubscription = API.graphql(graphqlOperation(onCreateRootCause)).subscribe({
      next: (response: any) => {
        const { rootCauses } = this.state;
        const newRootCause = response.value.data.onCreateRootCause;
        newRootCause.visible = true;

        const newRootCauses = sortByName([...rootCauses, newRootCause], SortBy.Asc, 'rootCause');
        this.setState({ rootCauses: newRootCauses });

        // To prevent unwanted root cause while editing, saved root causes consist of themselves and new one.
        this.savedRootCauses = sortByName([...this.savedRootCauses, newRootCause], SortBy.Asc, 'rootCause');
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });

    // Subscribe to delete root cause
    this.deleteRootCauseSubscription = API.graphql(graphqlOperation(onDeleteRootCause)).subscribe({
      next: (response: any) => {
        const { rootCauses } = this.state;
        const deletedRootCause = response.value.data.onDeleteRootCause;
        const index = this.savedRootCauses.findIndex((rootCause: IRootCause) => rootCause.id === deletedRootCause.id);
        deletedRootCause.visible = true;
        deletedRootCause.deleted = true;

        this.setState({
          rootCauses: [...rootCauses.slice(0, index), deletedRootCause, ...rootCauses.slice(index + 1)]
        });

        this.savedRootCauses = [...this.savedRootCauses.slice(0, index), ...this.savedRootCauses.slice(index + 1)];
      },
      error: () => {
        // If there's an error (e.g. connection closed), reload the window.
        window.location.reload();
      }
    });
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    this.createRootCauseSubscription.unsubscribe();
    this.deleteRootCauseSubscription.unsubscribe();
  }

  /**
   * Get the process detail.
   */
  async getProcess() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Graphql operation to get a site
      const { processId } = this.props.match.params;
      const response = await API.graphql(graphqlOperation(getProcess, { id: processId }));
      const resultData = response.data.getProcess;

      const siteId = resultData.area.site.id;
      const siteName = `: ${resultData.area.site.name}`;
      const areaId = resultData.area.id;
      const areaName = `: ${resultData.area.name}`;
      let events: IEvent[] = resultData.event.items;

      // Make all events visible.
      makeAllVisible(events);

      // Sorts initially
      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        processId,
        events,
        title: `${I18n.get('text.events')} (${events.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting process', error);
      this.setState({ error: I18n.get('error.get.process') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Get root causes.
   */
  async getRootCauses() {
    try {
      const rootCauses: IRootCause[] = await this.graphQlCommon.listRootCauses();

      // Make all root causes visible.
      makeAllVisible(rootCauses);

      const sortedRootCauses = sortByName(rootCauses, SortBy.Asc, 'rootCause');
      this.savedRootCauses = [...sortedRootCauses];

      this.setState({
        rootCauses: [...sortedRootCauses]
      });
    } catch (error) {
      LOGGER.error('Error occurred while getting users.');
      this.setState((prevState) => ({
        error: `${prevState.error}\n${I18n.get('error.get.rootcauses')}`
      }));
    }
  }

  /**
   * Delete an event.
   */
  async deleteEvent() {
    this.setState({ isModalProcessing: true });

    try {
      const { eventId } = this.state;
      await this.graphQlCommon.deleteEvent(eventId);

      const updatedEvents = this.state.events.filter(event => event.id !== eventId);

      this.props.handleNotification(I18n.get('info.delete.event'), 'success', 5);
      this.setState({
        events: updatedEvents,
        title: `${I18n.get('text.events')} (${updatedEvents.length})`,
        eventId: '',
        eventName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.event');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while delete event', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register an event.
   */
  async addEvent() {
    let topicArn: string = '';
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to list events
      const { processId, events, eventName, eventDescription, eventSms, eventEmail, eventPriority, eventType, searchKeyword, sort } = this.state;
      const queryEvents: IEvent[] = await this.graphQlCommon.listEvents(processId);

      // Check if the same event name exists in the process
      const existingEventLength = queryEvents.filter(event => event.name === eventName).length;
      if (existingEventLength > 0) {
        this.props.handleNotification(I18n.get('error.duplicate.event.name'), 'error', 5);
        this.setState({ isModalProcessing: false });
      } else {
        // Create topic if SMS or E-Mail is provided only.
        if (eventSms !== '' || eventEmail !== '') {
          topicArn = await this.createSns();
        }

        // Graphql operation to register a event
        let input: IEvent = {
          name: eventName,
          eventProcessId: processId,
          description: eventDescription,
          priority: eventPriority,
          __typename: 'Event',
          rootCauses: this.rootCauses
        };

        if (topicArn !== '') {
          input.topicArn = topicArn;
        }

        if (eventSms !== '') {
          input.sms = eventSms;
        }

        if (eventEmail !== '') {
          input.email = eventEmail;
        }

        if (eventType !== '') {
          input.type = eventType;
        }

        const response = await API.graphql(graphqlOperation(createEvent, input));
        let newEvent: IEvent = response.data.createEvent;
        newEvent.visible = searchKeyword === '' || newEvent.name.toLowerCase().includes(searchKeyword.toLowerCase());

        const newEvents = [...events, newEvent];

        this.setState({
          events: (sortByName(newEvents, sort, 'name') as IEvent[]),
          title: `${I18n.get('text.events')} (${newEvents.length})`,
          eventName: '',
          eventDescription: '',
          eventSms: '',
          eventEmail: '',
          eventPriority: EventPriority.Low,
          eventType: '',
          rootCauses: [...this.savedRootCauses],
          isModalProcessing: false,
          isEventNameValid: false,
          isEventDescriptionValid: false,
          isEventSmsValid: true,
          isEventEmailValid: true,
          isEventTypeValid: true,
          selectAllRootCauses: false,
          showModal: false,
          modalTitle: '',
          modalType: ModalType.None
        });

        this.rootCauses = [];

        this.props.handleNotification(I18n.get('info.add.event'), 'info', 5);
        await sendMetrics({ 'event': 1 });
      }
    } catch (error) {
      let message = I18n.get('error.create.event');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.event.name');
        }
      }

      // Delete SNS topic if it exists.
      if (topicArn !== '') {
        try {
          await this.graphQlCommon.deleteSns(topicArn);
        } catch (snsError) {
          LOGGER.error('Error while deleting SNS', snsError);
        }
      }

      LOGGER.error('Error while creating event', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Edit an event.
   */
  async editEvent() {
    let topicArn: string = '';
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to list events
      const { events, eventId, eventSms, eventEmail, searchKeyword, eventTopicArn } = this.state;

      if (eventTopicArn === '') {
        // Create topic if there is no topic and SMS or E-Mail is provided.
        if (eventSms !== '' || eventEmail !== '') {
          topicArn = await this.createSns();
        }
      } else {
        // Delete topic if SMS and E-Mail are empty, and update if SMS or E-Mail is provided.
        if (eventSms === '' && eventEmail === '') {
          await this.graphQlCommon.deleteSns(eventTopicArn);
        } else {
          // Delete the current subscriptions and subscribe E-Mail and SMS number.
          await this.unsubscribeSns(eventTopicArn);
          await this.subscribeSns(eventTopicArn, eventEmail, eventSms);
        }
      }

      // Graphql operation to register a event
      let input: IEventUpdate = {
        id: eventId,
        rootCauses: this.rootCauses
      };

      if (topicArn !== '') {
        input.topicArn = topicArn;
      }

      if (eventSms !== '') {
        input.sms = eventSms;
      }

      if (eventEmail !== '') {
        input.email = eventEmail;
      }

      const response = await API.graphql(graphqlOperation(updateEvent, input));
      let updatedEvent: IEvent = response.data.updateEvent;
      updatedEvent.visible = searchKeyword === '' || updatedEvent.name.includes(searchKeyword);

      const index = events.findIndex((event: IEvent) => event.id === updatedEvent.id);
      const updatedEvents = [...events.slice(0, index), updatedEvent, ...events.slice(index + 1)];

      this.setState({
        events: updatedEvents,
        eventName: '',
        eventDescription: '',
        eventSms: '',
        eventEmail: '',
        eventPriority: EventPriority.Low,
        eventType: '',
        eventTopicArn: '',
        rootCauses: [...this.savedRootCauses],
        isModalProcessing: false,
        isEventNameValid: false,
        isEventDescriptionValid: false,
        isEventSmsValid: true,
        isEventEmailValid: true,
        isEventTypeValid: true,
        selectAllRootCauses: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.rootCauses = [];

      this.props.handleNotification(I18n.get('info.edit.event'), 'info', 5);
    } catch (error) {
      let message = I18n.get('error.update.event');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      // Delete SNS topic if it exists.
      if (topicArn !== '') {
        try {
          await this.graphQlCommon.deleteSns(topicArn);
        } catch (snsError) {
          LOGGER.error('Error while deleting SNS', snsError);
        }
      }

      LOGGER.error('Error while updating event', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Create an Amazon SNS topic
   * @return {Promise<string>} SNS Topic ARN
   */
  async createSns(): Promise<string> {
    const credentials = await Auth.currentCredentials();
    const sns = new SNS({
      apiVersion: '2010-03-31',
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(credentials)
    });

    try {
      const params = {
        Name: `andon-${uuid.v4()}`,
        Attributes: {
          'KmsMasterKeyId': 'alias/aws/sns'
        },
        Tags: [
          {
            Key: 'amazon-virtual-andon',
            Value: 'amazon-virtual-andon'
          }
        ]
      };
      const response = await sns.createTopic(params).promise();

      // Subscribe E-Mail and SMS number.
      await this.subscribeSns(response.TopicArn as string, this.state.eventEmail, this.state.eventSms);

      return response.TopicArn as string;
    } catch (error) {
      throw new Error (error.message);
    }
  }

  /**
   * Subscribe SNS topic.
   * @param {string} topicArn - Topic ARN
   * @param {string} email - SNS E-Mail address
   * @param {string} sms - SNS SMS number
   */
  async subscribeSns(topicArn: string, email: string, sms: string) {
    const credentials = await Auth.currentCredentials();
    const sns = new SNS({
      apiVersion: '2010-03-31',
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(credentials)
    });

    if (email !== '') {
      try {
        await sns.subscribe({ Protocol: 'email', TopicArn: topicArn, Endpoint: email }).promise();
      } catch (error) {
        this.props.handleNotification(I18n.get('error.set.email.notification'), 'warning', 5);
        LOGGER.error(error.message);
      }
    }

    // If SMS number is empty, skip the subscription.
    if (sms !== '') {
      try {
        await sns.subscribe({ Protocol: 'sms', TopicArn: topicArn, Endpoint: sms }).promise();
      } catch (error) {
        this.props.handleNotification(I18n.get('warning.set.no.sms'), 'warning', 5);
        LOGGER.error(error.message);
      }
    }
  }

  /**
   * Unsubscribe the current subscriptions from SNS topic.
   * @param {string} topicArn - Topic ARN
   */
  async unsubscribeSns(topicArn: string) {
    const credentials = await Auth.currentCredentials();
    const sns = new SNS({
      apiVersion: '2010-03-31',
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(credentials)
    });

    const subscriptions = await sns.listSubscriptionsByTopic({ TopicArn: topicArn }).promise();
    const promises = [];

    if (subscriptions.Subscriptions) {
      for (const subscription of subscriptions.Subscriptions) {
        const subscriptionArn = subscription.SubscriptionArn as string;
        // If the subscription is still pending confirmation, there is no subscription ARN.
        if (subscriptionArn !== 'PendingConfirmation') {
          promises.push(sns.unsubscribe({ SubscriptionArn: subscriptionArn }).promise());
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType- Moddal type
   * @param {IEvent | undefined} event - Event
   */
  openModal(modalType: ModalType, event?: IEvent) {
    let modalTitle = '';
    const { rootCauses } = this.state;

    if (modalType === ModalType.Add) {
      modalTitle = I18n.get('text.event.registration');
    } else if (modalType === ModalType.Edit) {
      modalTitle = I18n.get('text.edit.event');
    } else if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.event');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
      return;
    }

    let eventId = '';
    let eventName = '';
    let eventDescription = '';
    let eventSms = '';
    let eventEmail = '';
    let eventTopicArn = '';
    let eventPriority = EventPriority.Low;

    if (event) {
      eventId = event.id ? event.id : '';
      eventName = event.name;
      eventDescription = event.description;
      eventSms= event.sms ? event.sms : '';
      eventEmail = event.email ? event.email : '';
      eventTopicArn = event.topicArn ? event.topicArn : '';

      for (const priority in EventPriority) {
        if (priority === event.priority) {
          eventPriority = EventPriority[priority as keyof typeof EventPriority];
          break;
        }
      }

      this.rootCauses = event.rootCauses ? event.rootCauses : [];

      // If event has deleted root causes, users can see.
      for (const rootCause of this.rootCauses) {
        const index = rootCauses.findIndex((hasRootCause: IRootCause) => hasRootCause.rootCause === rootCause);
        if (index < 0) {
          const newRootCause = {
            id: uuid.v4(),
            rootCause,
            visible: true,
            deleted: true
          };
          rootCauses.push(newRootCause);
        }
      }
    }

    this.setState({
      modalType,
      modalTitle,
      eventId,
      eventName,
      eventDescription,
      eventPriority,
      eventSms,
      eventEmail,
      eventTopicArn,
      rootCauses: sortByName(rootCauses, SortBy.Asc, 'rootCause'),
      selectAllRootCauses: rootCauses.length > 0 && rootCauses.length === this.rootCauses.length,
      showModal: true
    });
  }

  /**
   * Get unique root causes from the provided array.
   * @param {string[]} rootCauses - Array to get unique root causes
   * @return {string[]} Unique root causes array
   */
  getUniqueRootCauses(rootCauses: string[]): string[] {
    return Array.from(new Set(rootCauses));
  }

  /**
   * Handle the search keyword change to filter the events result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { events } = this.state;

    makeVisibleBySearchKeyword(events, 'name', searchKeyword);
    this.setState({ events, searchKeyword });
  }

  /**
   * Handle events sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const events = (sortByName(this.state.events, sort, 'name') as IEvent[]);

    this.setState({ events, sort });
  }

  /**
   * Handle the search keyword change to filter the root causes.
   * @param {any} event - Event from the root cause search keyword input
   */
  handleRootCauseSearchKeywordChange(event: any) {
    const rootCauseSearchKeyword = event.target.value;
    let { rootCauses } = this.state;

    for (let rootCause of rootCauses) {
      if (rootCauseSearchKeyword === '' || rootCause.rootCause.toLowerCase().includes(rootCauseSearchKeyword.toLowerCase())) {
        rootCause.visible = true;
      } else {
        rootCause.visible = false;
      }
    }

    // Compare if visible root causes are all checked.
    const visibleRootCauses = rootCauses.filter((rootCause: IRootCause) => rootCause.visible);
    const filteredCheckedRootCauses = this.rootCauses.filter((rootCause: string) => {
      const index = visibleRootCauses.findIndex((visibleRootCause: IRootCause) => visibleRootCause.rootCause === rootCause);
      return index > -1;
    });

    this.setState({
      rootCauses,
      rootCauseSearchKeyword,
      selectAllRootCauses: visibleRootCauses.length > 0 && visibleRootCauses.length === filteredCheckedRootCauses.length
    });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      rootCauses: [...this.savedRootCauses],
      rootCauseSearchKeyword: '',
      eventId: '',
      eventName: '',
      eventDescription: '',
      eventEmail: '',
      eventSms: '',
      eventPriority: EventPriority.Low,
      eventType: '',
      isEventNameValid: false,
      isEventDescriptionValid: false,
      isEventSmsValid: true,
      isEventEmailValid: true,
      isEventTypeValid: true,
      selectAllRootCauses: false,
      showModal: false
    });

    this.rootCauses = [];
  }

  /**
   * Handle the event name change.
   * @param {any} event - Event from the event name input
   */
  handleEventNameChange(event: any) {
    const eventName = event.target.value;
    const isEventNameValid = validateGeneralInput(eventName, 1, 40, '- _/#');

    this.setState({
      eventName,
      isEventNameValid
    });
  }


  /**
   * Handle the event description change.
   * @param {any} event - Event from the event description input
   */
  handleEventDescriptionChange(event: any) {
    const eventDescription = event.target.value;
    const isEventDescriptionValid = validateGeneralInput(eventDescription, 1, 40, '- _/#');

    this.setState({
      eventDescription,
      isEventDescriptionValid
    });
  }

  /**
   * Handle the event SMS No change.
   * @param {any} event - Event from the event SMS No input
   */
  handleEventSmsChange(event: any) {
    const eventSms = event.target.value;
    const isEventSmsValid = eventSms === '' || validatePhoneNumber(eventSms);

    this.setState({
      eventSms,
      isEventSmsValid
    });
  }

  /**
   * Handle the event E-Mail address change.
   * @param {any} event - Event from the event E-Mail address input
   */
  handleEventEmailChange(event: any) {
    const eventEmail = event.target.value;
    const isEventEmailValid = eventEmail === '' || validateEmailAddress(eventEmail);

    this.setState({
      eventEmail,
      isEventEmailValid
    });
  }

  /**
   * Handle the event priority change.
   * @param {any} event - Event from the event description input
   */
  handleEventPriorityChange(event: any) {
    const eventPriority = event.target.value;

    this.setState({ eventPriority });
  }

  /**
   * Handle the event type change.
   * @param {any} event - Event from the event type input
   */
  handleEventTypeChange(event: any) {
    const eventType = event.target.value;
    const isEventTypeValid = eventType === '' || validateGeneralInput(eventType, 1, 40, '- _/');

    this.setState({
      eventType,
      isEventTypeValid
    });
  }

  /**
   * Handle the root cause change.
   * @param {any} event - Event from the root cause checkbox
   */
  handleCheckboxChange(event: any, ) {
    const { id, checked } = event.target;

    if (id === 'all') {
      // When all checkbox is clicked
      const { rootCauses } = this.state;

      if (checked) {
        for (const rootCause of rootCauses) {
          if (rootCause.visible) {
            this.rootCauses = this.getUniqueRootCauses([...this.rootCauses, rootCause.rootCause]);
          }
        }
      } else {
        for (const rootCause of rootCauses) {
          if (rootCause.visible) {
            const index = this.rootCauses.findIndex((removedRootCause: string) => removedRootCause === rootCause.rootCause);
            this.rootCauses = [...this.rootCauses.slice(0, index), ...this.rootCauses.slice(index + 1)];
          }
        }
      }

      this.setState({ selectAllRootCauses : checked });
    } else {
      // When individual checkbox is clicked
      const checkedRootCause = JSON.parse(id);

      if (checked) {
        this.rootCauses.push(checkedRootCause.rootCause);
      } else {
        const index = this.rootCauses.findIndex((removedRootCause: string) => removedRootCause === checkedRootCause.rootCause);
        this.rootCauses = [...this.rootCauses.slice(0, index), ...this.rootCauses.slice(index + 1)];
      }

      // Compare if visible root causes are all checked.
      const visibleRootCauses = this.state.rootCauses.filter((rootCause: IRootCause) => rootCause.visible);
      const filteredCheckedRootCauses = this.rootCauses.filter((rootCause: string) => {
        const index = visibleRootCauses.findIndex((visibleRootCause: IRootCause) => visibleRootCause.rootCause === rootCause);
        return index > -1;
      });

      this.setState({ selectAllRootCauses: visibleRootCauses.length > 0 && visibleRootCauses.length === filteredCheckedRootCauses.length });
    }
  }

  /**
   * Render this page.
   */
  render() {
    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <LinkContainer to="/sites" exact>
                  <Breadcrumb.Item>{ I18n.get('text.sites') }</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{ I18n.get('text.areas') }{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/areas/${this.state.areaId}/processes`} exact>
                  <Breadcrumb.Item>{ I18n.get('info.processes') }{this.state.areaName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{ I18n.get('text.events') }{this.state.processName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ I18n.get('button.add.event') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>{this.state.title}</Card.Title>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} md={4} controlId="searchKeyword">
                        <Form.Label>{ I18n.get('text.search.keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ I18n.get('text.search.event.name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{ I18n.get('text.sort.by') }</Form.Label>
                        <Form.Control as="select" defaultValue={this.state.sort} onChange={this.handleSort}>
                          <option value={SortBy.Asc}>A-Z</option>
                          <option value={SortBy.Desc}>Z-A</option>
                        </Form.Control>
                      </Form.Group>
                    </Form.Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            {
              this.state.events.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ I18n.get('text.no.event') }</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.events.filter((event: IEvent) => event.visible)
                .map((event: IEvent) => {
                  let { priority } = event;
                  priority = I18n.get(`text.priority.${priority}`);

                  if (priority.includes('text.priority')) {
                    priority = I18n.get('text.not.found');
                  }

                  return (
                    <Col md={4} key={event.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{event.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{ I18n.get('text.description') }</td>
                                <td>{event.description}</td>
                              </tr>
                              <tr>
                                <td>{ I18n.get('text.sms') }</td>
                                <td>{event.sms}</td>
                              </tr>
                              <tr>
                                <td>{ I18n.get('text.email') }</td>
                                <td>{event.email}</td>
                              </tr>
                              <tr>
                                <td>{ I18n.get('text.priority') }</td>
                                <td>{priority}</td>
                              </tr>
                              <tr>
                                <td>{ I18n.get('text.type') }</td>
                                <td>{event.type}</td>
                              </tr>
                              <tr>
                                <td>{ I18n.get('text.rootcauses') }</td>
                                <td>
                                {
                                  event.rootCauses ? `${event.rootCauses.length} ${I18n.get('text.attached.rootcause')}` : ''
                                }
                                </td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, event)}>{ I18n.get('button.delete') }</Button>
                              <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Edit, event)}>{ I18n.get('button.edit') }</Button>
                            </Form.Row>
                          </Form>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })
            }
          </Row>
          {
            this.state.isLoading &&
            <Row>
              <Col>
                <ProgressBar animated now={100} />
              </Col>
            </Row>
          }
          {
            this.state.error &&
            <Row>
              <Col>
                <Alert variant="danger">
                  <strong>{ I18n.get('error') }:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{this.state.modalTitle}</Modal.Title>
          </Modal.Header>
          {
            [ModalType.Add, ModalType.Edit].includes(this.state.modalType) &&
            <div>
              <Modal.Body>
                <Alert variant="warning">
                  <span className="required-field">*</span> { I18n.get('info.create.event') }
                </Alert>
                <Form>
                  <Form.Row>
                    <Form.Group as={Col} md={6} controlId="eventName">
                      <Form.Label>{ I18n.get('text.event.name') } <span className="required-field">*</span></Form.Label>
                      <Form.Control required type="text" placeholder={ I18n.get('input.event.nat') }
                        defaultValue={this.state.eventName} onChange={this.handleEventNameChange} className={ this.state.modalType === ModalType.Add ? getInputFormValidationClassName(this.state.eventName, this.state.isEventNameValid) : '' } disabled={this.state.modalType === ModalType.Edit} />
                      {
                        this.state.modalType === ModalType.Add &&
                        <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                      }
                    </Form.Group>
                    <Form.Group as={Col} md={6} controlId="eventDescription">
                      <Form.Label>{ I18n.get('text.event.description') } <span className="required-field">*</span></Form.Label>
                      <Form.Control required type="text" placeholder={ I18n.get('input.event.description') }
                        defaultValue="" onChange={this.handleEventDescriptionChange} className={ this.state.modalType === ModalType.Add ? getInputFormValidationClassName(this.state.eventDescription, this.state.isEventDescriptionValid) : ''  } disabled={this.state.modalType === ModalType.Edit} />
                      {
                        this.state.modalType === ModalType.Add &&
                        <Form.Text className="text-muted">{ `(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}` }</Form.Text>
                      }
                    </Form.Group>
                  </Form.Row>
                  <Form.Row>
                    <Form.Group as={Col} md={6} controlId="eventSms">
                      <Form.Label>{ I18n.get('text.sms.no') }</Form.Label>
                      <Form.Control type="text" placeholder={ I18n.get('input.sms') }
                        defaultValue={this.state.eventSms} onChange={this.handleEventSmsChange} className={ getInputFormValidationClassName(this.state.eventSms, this.state.isEventSmsValid) } />
                      <Form.Text className="text-muted">{ `(${I18n.get('text.optional')}) ${I18n.get('info.valid.phone.number')}` }</Form.Text>
                    </Form.Group>
                    <Form.Group as={Col} md={6} controlId="eventEmail">
                      <Form.Label>{ I18n.get('text.email') }</Form.Label>
                      <Form.Control type="text" placeholder={ I18n.get('input.group.email') }
                        defaultValue={this.state.eventEmail} onChange={this.handleEventEmailChange} className={ getInputFormValidationClassName(this.state.eventEmail, this.state.isEventEmailValid) } />
                      <Form.Text className="text-muted">{ `(${I18n.get('text.optional')}) ${I18n.get('info.valid.email')}` }</Form.Text>
                    </Form.Group>
                  </Form.Row>
                  {
                    this.state.modalType === ModalType.Add &&
                    <div>
                      <Form.Row>
                        <Form.Group as={Col} md={6} controlId="eventPriority">
                          <Form.Label>{ I18n.get('text.event.priority') } <span className="required-field">*</span></Form.Label>
                          <Form.Control as="select" defaultValue={this.state.eventPriority} onChange={this.handleEventPriorityChange}>
                            <option value={EventPriority.Low}>{ I18n.get('text.priority.low') }</option>
                            <option value={EventPriority.Medium}>{ I18n.get('text.priority.medium') }</option>
                            <option value={EventPriority.High}>{ I18n.get('text.priority.high') }</option>
                            <option value={EventPriority.Critical}>{ I18n.get('text.priority.critical') }</option>
                          </Form.Control>
                        </Form.Group>
                        <Form.Group as={Col} md={6} controlId="eventType">
                          <Form.Label>{ I18n.get('text.event.type') }</Form.Label>
                          <Form.Control required type="text" placeholder={ I18n.get('input.event.type') }
                            defaultValue="" onChange={this.handleEventTypeChange} className={ getInputFormValidationClassName(this.state.eventType, this.state.isEventTypeValid) } />
                          <Form.Text className="text-muted">{ `(${I18n.get('text.optional')}) ${I18n.get('info.valid.event.type')}` }</Form.Text>
                        </Form.Group>
                      </Form.Row>
                    </div>
                  }
                  <Form.Row>
                    <Form.Label>{ I18n.get('text.rootcauses') }</Form.Label>
                    <Table striped bordered>
                      <thead>
                        <tr>
                          <th className="fixed-th-20">
                            <Form.Check type="checkbox" id="all" checked={this.state.selectAllRootCauses} onChange={this.handleCheckboxChange} />
                          </th>
                          <th>
                            <Form.Group className="form-group-no-margin">
                              <Form.Control size="sm" type="text" placeholder={ I18n.get('text.search.rootcause') } onChange={this.handleRootCauseSearchKeywordChange} />
                            </Form.Group>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                      {
                        this.state.rootCauses.filter((rootCause: IRootCause) => rootCause.visible)
                          .map((rootCause: IRootCause) => {
                            const rootCauseId = JSON.stringify({ id: rootCause.id, rootCause: rootCause.rootCause });
                            const isRootCauseChecked: boolean = this.rootCauses.findIndex((checkedRootCause: string) => checkedRootCause === rootCause.rootCause) > -1;

                            return (
                              <tr key={rootCause.id}>
                                <td>
                                  <Form.Check type="checkbox" id={rootCauseId} checked={isRootCauseChecked} onChange={this.handleCheckboxChange} />
                                </td>
                                <td>{rootCause.rootCause}{rootCause.deleted ? ` (${I18n.get('text.deleted')})` : ''}</td>
                              </tr>
                            );
                          })
                      }
                      </tbody>
                    </Table>
                  </Form.Row>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                {
                  this.state.modalType === ModalType.Add &&
                  <Button variant="primary" onClick={this.addEvent}
                    disabled={
                      this.state.isModalProcessing ||
                      !this.state.isEventNameValid ||
                      !this.state.isEventDescriptionValid ||
                      !this.state.isEventSmsValid ||
                      !this.state.isEventEmailValid ||
                      !this.state.isEventTypeValid
                    }>{ I18n.get('button.register') }</Button>
                }
                {
                  this.state.modalType === ModalType.Edit &&
                  <Button variant="primary" onClick={this.editEvent}
                    disabled={
                      this.state.isModalProcessing ||
                      !this.state.isEventSmsValid ||
                      !this.state.isEventEmailValid
                    }>{ I18n.get('button.save') }</Button>
                }
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { I18n.get('text.confirm.delete.event') }: <strong>{this.state.eventName}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ I18n.get('button.close') }</Button>
                <Button variant="danger" onClick={this.deleteEvent} disabled={this.state.isModalProcessing}>{ I18n.get('button.delete') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.isModalProcessing &&
            <ProgressBar animated now={100} />
          }
        </Modal>
      </div>
    );
  }
}

export default Event;