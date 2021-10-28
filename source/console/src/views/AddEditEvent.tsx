// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React, Amplify, and AWS SDK packages
import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation, I18n, Storage } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { Logger } from '@aws-amplify/core';
import { AmplifyS3Image } from "@aws-amplify/ui-react";
import { GoX } from 'react-icons/go';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import ListGroup from 'react-bootstrap/ListGroup'

// Import graphql
import { getProcess } from '../graphql/queries';
import { createEvent, updateEvent } from '../graphql/mutations';
import { onCreateRootCause, onDeleteRootCause } from '../graphql/subscriptions';

// Import UUID
import * as uuid from 'uuid';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, validatePhoneNumber, validateEmailAddress, sortByName, getInputFormValidationClassName, makeAllVisible, handleSubscriptionError } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IEvent, IEventUpdate, IRootCause } from '../components/Interfaces';
import { EventPriority, SortBy } from '../components/Enums';
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
  event?: IEvent;
  rootCauses: IRootCause[];
  isLoading: boolean;
  rootCauseSearchKeyword: string;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  processId: string;
  processName: string;
  eventName: string;
  eventDescription: string;
  eventSms: string;
  eventEmail: string;
  eventPriority: EventPriority;
  eventType: string;
  eventTopicArn: string;
  isEventNameValid: boolean;
  isEventDescriptionValid: boolean;
  isEventSmsValid: boolean;
  isEventEmailValid: boolean;
  isEventTypeValid: boolean;
  selectAllRootCauses: boolean;
  eventImgKeys: string[];
  eventImgKey: string;
  eventModalError: string;
  showEventImageLibrary: boolean;
  eventAlias: string;
  isEventAliasValid: boolean;
  isPageLoading: boolean;
  isFatalError: boolean;
  showSubEventModal: boolean;
  isModalProcessing: boolean;
  existingSubEvents: IEvent[];
  toBeAddedSubEvents: IEvent[];
  toBeDeletedSubEvents: IEvent[];
  imageSelectSubEventId: string;
  modifiedExistingSubEventIds: string[];
}

/**
 * Types of subscriptions that will be maintained by the main Event class
 */
export enum EventSubscriptionTypes {
  CREATE_ROOT_CAUSE,
  DELETE_ROOT_CAUSE
}

// Logging
const LOGGER = new Logger('AddEditEvent', LOGGING_LEVEL);

/**
 * Page for adding a new or editing an existing Event
 * @class AddEditEvent
 */
class AddEditEvent extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create root cause subscription
  private createRootCauseSubscription: any;
  // Delete root cause subscription
  private deleteRootCauseSubscription: any;
  // The saved root causes would save the original state of queried root causes.
  private savedRootCauses: IRootCause[];
  // Root causes for events
  private rootCauses: string[];

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      rootCauses: [],
      isLoading: false,
      rootCauseSearchKeyword: '',
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      processId: '',
      processName: '',
      eventName: '',
      eventDescription: '',
      eventSms: '',
      eventEmail: '',
      eventPriority: EventPriority.Low,
      eventType: '',
      eventTopicArn: '',
      isEventNameValid: false,
      isEventDescriptionValid: false,
      isEventSmsValid: true,
      isEventEmailValid: true,
      isEventTypeValid: true,
      selectAllRootCauses: false,
      eventImgKeys: [],
      eventImgKey: '',
      eventModalError: '',
      showEventImageLibrary: false,
      eventAlias: '',
      isEventAliasValid: true,
      isPageLoading: true,
      isFatalError: false,
      showSubEventModal: false,
      isModalProcessing: false,
      existingSubEvents: [],
      toBeAddedSubEvents: [],
      toBeDeletedSubEvents: [],
      imageSelectSubEventId: '',
      modifiedExistingSubEventIds: []
    };

    this.graphQlCommon = new GraphQLCommon();
    this.savedRootCauses = [];
    this.rootCauses = [];

    this.eventNameExists = this.eventNameExists.bind(this);
    this.addEvent = this.addEvent.bind(this);
    this.editEvent = this.editEvent.bind(this);
    this.loadEventImages = this.loadEventImages.bind(this);
    this.toggleEventImageLibrary = this.toggleEventImageLibrary.bind(this);
    this.onPickImageToUpload = this.onPickImageToUpload.bind(this);
    this.onSelectEventImage = this.onSelectEventImage.bind(this);
    this.configureSubscription = this.configureSubscription.bind(this);
    this.isEditMode = this.isEditMode.bind(this);
    this.handleFormInputChange = this.handleFormInputChange.bind(this);
    this.shouldAllowFormSubmit = this.shouldAllowFormSubmit.bind(this);
    this.doMainFormSubmit = this.doMainFormSubmit.bind(this);
    this.doSubEventFormSubmit = this.doSubEventFormSubmit.bind(this);
    this.openSubEventModal = this.openSubEventModal.bind(this);
    this.loadSubEvents = this.loadSubEvents.bind(this);
    this.displaySubEvents = this.displaySubEvents.bind(this);
    this.addSubEvent = this.addSubEvent.bind(this);
    this.markSubEventForDeletion = this.markSubEventForDeletion.bind(this);
    this.addNewSubEventRow = this.addNewSubEventRow.bind(this);
    this.createNewToBeAddedSubEvent = this.createNewToBeAddedSubEvent.bind(this);
    this.handleAllRootCauseCheckboxFormInputChange = this.handleAllRootCauseCheckboxFormInputChange.bind(this);
    this.handleIndividualRootCauseCheckboxFormInputChange = this.handleIndividualRootCauseCheckboxFormInputChange.bind(this);
    this.handleRootCauseFilterTextBoxFormInputChange = this.handleRootCauseFilterTextBoxFormInputChange.bind(this);
    this.handleSubEventFormInputChange = this.handleSubEventFormInputChange.bind(this);
    this.showSubEventImageSelect = this.showSubEventImageSelect.bind(this);
    this.onSelectSubEventImage = this.onSelectSubEventImage.bind(this);
    this.editSubEvent = this.editSubEvent.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get process and root causes
    await this.getProcess();
    await this.getRootCauses();

    // Load any event images in the image library
    await this.loadEventImages();

    // Configure subscriptions
    for (const evtSubscriptionType of Object.values(EventSubscriptionTypes).filter(t => typeof t === 'number')) {
      await this.configureSubscription(evtSubscriptionType as EventSubscriptionTypes);
    }

    if (this.isEditMode()) {
      // When editing, make sure previously-selected root causes are checked
      this.rootCauses = (this.state.event && this.state.event.rootCauses) ? [...this.state.event.rootCauses] : [];
    }

    this.setState({ isPageLoading: false });
  }

  /**
   * Configures the subscription for the supplied `subscriptionType`
   * @param subscriptionType The type of subscription to configure
   * @param delayMS (Optional) This value will be used to set a delay for reestablishing the subscription if the socket connection is lost
   */
  async configureSubscription(subscriptionType: EventSubscriptionTypes, delayMS: number = 10): Promise<void> {
    try {
      switch (subscriptionType) {
        case EventSubscriptionTypes.CREATE_ROOT_CAUSE:
          if (this.createRootCauseSubscription) { this.createRootCauseSubscription.unsubscribe(); }

          // @ts-ignore
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
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
        case EventSubscriptionTypes.DELETE_ROOT_CAUSE:
          if (this.deleteRootCauseSubscription) { this.deleteRootCauseSubscription.unsubscribe(); }

          // @ts-ignore
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
            error: async (e: any) => {
              await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
            }
          });
          break;
      }
    } catch (err) {
      LOGGER.error('Unable to configure subscription', err);
    }
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    if (this.createRootCauseSubscription) this.createRootCauseSubscription.unsubscribe();
    if (this.deleteRootCauseSubscription) this.deleteRootCauseSubscription.unsubscribe();
  }

  /**
   * Retrieves a list of event image keys from S3 so the images can be displayed
   * upon opening the event image library
   */
  async loadEventImages() {
    this.setState({ isLoading: true });
    try {
      const eventImgs = await Storage.list('event-images/', { level: 'public' });
      this.setState({
        eventImgKeys: eventImgs.map((img: any) => img.key)
      });
    } catch (err) {
      LOGGER.error(err);
    }

    this.setState({ isLoading: false });
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
      const { processId, eventId } = this.props.match.params;

      const response = await API.graphql(graphqlOperation(getProcess, { id: processId })) as GraphQLResult;
      const data: any = response.data;
      const resultData = data.getProcess;

      const siteId = resultData.area.site.id;
      const siteName = resultData.area.site.name;
      const areaId = resultData.area.id;
      const areaName = resultData.area.name;
      const processName = resultData.name;

      if (eventId) {
        // Find the event that matches the `eventId` in the URL
        const event = (resultData.event.items as IEvent[]).find(e => e.id === eventId);

        if (!event) {
          // If the event is not found, display an error
          this.setState({ isFatalError: true, error: `${I18n.get('error.event.id.not.found')} (${eventId})` });
        } else {
          // Populate the state with the values from the event matched to the `eventId` in the URL
          this.setState({
            event,
            eventName: event.name,
            eventDescription: event.description,
            eventEmail: event.email || '',
            eventSms: event.sms || '',
            eventAlias: event.alias || '',
            eventImgKey: event.eventImgKey || ''
          });
        }
      }

      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        processId,
        processName
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
   * Checks if the supplied event name is used for any other events in this Process
   * @param eventName The event name to check
   */
  async eventNameExists(eventName: string): Promise<boolean> {
    const { processId } = this.state;
    const eventsInProcess: IEvent[] = await this.graphQlCommon.listEvents(processId);
    return eventsInProcess.some(e => e.name.trim() === eventName.trim());
  }

  /**
   * Register an event.
   */
  async addEvent() {
    this.setState({ isLoading: true });

    try {
      // Graphql operation to list events
      const { processId, eventName, eventDescription, eventPriority } = this.state;

      if (await this.eventNameExists(eventName)) {
        this.props.handleNotification(I18n.get('error.duplicate.event.name'), 'error', 5);
        this.setState({ isLoading: false });
      } else {
        // Graphql operation to register a event
        let input: any = {
          name: eventName,
          type: 'EVENT',
          eventProcessId: processId,
          description: eventDescription,
          priority: eventPriority,
          rootCauses: this.rootCauses
        };

        const propertyMaps: { stateProp: keyof IState, inputProp: keyof IEvent }[] = [
          { stateProp: 'eventSms', inputProp: 'sms' },
          { stateProp: 'eventEmail', inputProp: 'email' },
          { stateProp: 'eventType', inputProp: 'eventType' },
          { stateProp: 'eventImgKey', inputProp: 'eventImgKey' },
          { stateProp: 'eventAlias', inputProp: 'alias' }
        ];

        for (const map of propertyMaps) {
          if (this.state[map.stateProp] !== '') {
            input[map.inputProp] = this.state[map.stateProp];
          }
        }

        await API.graphql(graphqlOperation(createEvent, input)) as GraphQLResult;
        this.props.handleNotification(I18n.get('info.add.event'), 'info', 5);
        await sendMetrics({ 'event': 1 });
        this.setState({ isLoading: false });
      }
    } catch (error: any) {
      let message = I18n.get('error.create.event');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.event.name');
        }
      }

      LOGGER.error('Error while creating event', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isLoading: false });
    }
  }

  /**
   * Register a sub event
   */
  async addSubEvent(subEvent: IEvent) {
    this.setState({ isLoading: true });

    if (this.state.existingSubEvents.some(e => e.name === subEvent.name)) {
      this.props.handleNotification(I18n.get('error.duplicate.event.name'), 'error', 5);
      this.setState({ isLoading: false });
    } else {
      // Set the sub event's properties based on user input for `name` and `eventImgKey`. Other required event properties
      // (such as `priority` & `eventType`) will be inherited from the parent event
      let input: IEvent = {
        id: subEvent.id!,
        type: 'EVENT',
        eventImgKey: subEvent.eventImgKey,
        name: subEvent.name,
        description: subEvent.name, // For sub events, use the name as the description
        priority: this.state.event!.priority,
        email: (this.state.event!.email && this.state.event!.email.trim() !== '') ? this.state.event!.email.trim() : undefined,
        sms: (this.state.event!.sms && this.state.event!.sms.trim() !== '') ? this.state.event!.sms.trim() : undefined,
        eventType: this.state.event!.eventType,
        parentId: subEvent.parentId!,
        eventProcessId: this.state.processId,
        rootCauses: this.state.event!.rootCauses
      };

      await API.graphql(graphqlOperation(createEvent, input));
      await sendMetrics({ 'sub-event': 1 });
      this.setState({ isLoading: false });
    }
  }

  /**
   * Edit an event.
   */
  async editEvent() {
    this.setState({ isLoading: true });

    try {
      const { event, eventSms, eventEmail, eventImgKey, eventAlias } = this.state;

      // Graphql operation to edit an event
      const input: IEventUpdate = {
        id: event!.id!,
        rootCauses: this.rootCauses
      };

      input.sms = eventSms;
      input.email = eventEmail;
      input.alias = eventAlias;

      if (eventImgKey !== '') {
        input.eventImgKey = eventImgKey;
      }

      const previousEventData = this.state.event;
      if (previousEventData) {
        input.previousSms = previousEventData.sms;
        input.previousEmail = previousEventData.email;
      }

      await API.graphql(graphqlOperation(updateEvent, input)) as GraphQLResult;
      this.props.handleNotification(I18n.get('info.edit.event'), 'info', 5);
      this.setState({ isLoading: false });
    } catch (error: any) {
      let message = I18n.get('error.update.event');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while updating event', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isLoading: false });
    }
  }

  /**
   * Edit a sub event.
   */
  async editSubEvent(subEvent: IEvent): Promise<void> {
    this.setState({ isLoading: true });

    // Graphql operation to edit an event
    const input: IEventUpdate = {
      id: subEvent.id!,
      rootCauses: subEvent.rootCauses || [],
      alias: subEvent.alias,
      email: subEvent.email,
      eventImgKey: subEvent.eventImgKey,
      sms: subEvent.sms
    };

    await API.graphql(graphqlOperation(updateEvent, input)) as GraphQLResult;
    this.setState({ isLoading: false });
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
   * Opens or closes the event image library
   */
  async toggleEventImageLibrary() {
    this.setState({
      showEventImageLibrary: !this.state.showEventImageLibrary
    });
  }

  /**
   * Use magic number to validate the file is an image
   * https://en.wikipedia.org/wiki/Magic_number_(programming)#In_files
   * @param file The file to inspect
   * @returns Promise<string>
   */
  async getFileType(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = (evt) => {
          try {
            if (evt && evt.target && evt.target.readyState === FileReader.DONE) {
              const bytes: string[] = [];
              new Uint8Array(evt.target.result as ArrayBuffer).forEach((byte) => bytes.push(byte.toString(16)));

              switch (bytes.join('').toUpperCase()) {
                case 'FFD8FFDB':
                case 'FFD8FFE0':
                  resolve('image/jpeg');
                  break;
                case '47494638':
                  resolve('image/gif');
                  break;
                case '89504E47':
                  resolve('image/png');
                  break;
                default:
                  reject('Unsupported file type');
                  break;
              }
            }
          } catch (err) {
            reject(err);
          }
        };

        reader.readAsArrayBuffer(file.slice(0, 4));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Uploads the event image that was selected from the local computer to S3
   * @param e Event handler for the select file browser dialog box
   * @returns
   */
  async onPickImageToUpload(e: any) {
    this.setState({ eventModalError: '' });
    if (!e.target || !e.target.files || !e.target.files[0]) {
      return;
    }

    const file = e.target.files[0];
    const { size } = file;
    const IMAGE_FILE_SIZE_LIMIT = 5000000; // 5MB
    if (size > IMAGE_FILE_SIZE_LIMIT) {
      this.setState({ eventModalError: I18n.get('error.limit.image.size') });
      return;
    }

    let fileType: string | undefined;

    try {
      fileType = await this.getFileType(file);
    } catch (err) {
      LOGGER.error(err);
    }

    if (!fileType) {
      this.setState({ eventModalError: I18n.get('error.image.type') });
      return;
    }

    this.setState({ isLoading: true });

    try {
      const imgKey = uuid.v4();

      const resp: any = await Storage.put(`event-images/${imgKey}`, file, { level: 'public', contentType: fileType });

      if (resp && resp.key) {
        if (this.state.showSubEventModal) {
          this.onSelectSubEventImage(resp.key);
        } else {
          this.setState({ eventImgKey: resp.key });
        }
      }

      this.setState((state, props) => ({
        isEventNameValid: validateGeneralInput(state.eventName, 1, 40, '- _/#'),
        isEventDescriptionValid: validateGeneralInput(state.eventDescription, 1, 40, '- _/#'),
        isEventSmsValid: validatePhoneNumber(state.eventSms, true),
        isEventEmailValid: validateEmailAddress(state.eventEmail, true),
        isEventTypeValid: validateGeneralInput(state.eventType, 0, 40, '- _/'),
        isEventAliasValid: validateGeneralInput(state.eventAlias, 0, 40, '- _/')
      }));
    } catch (err) {
      LOGGER.error(err);
    }

    await this.loadEventImages();
  }

  /**
   * Associates the selected S3 object key for the selected image with this event
   * @param imgKey S3 object key for the image that was selected
   */
  async onSelectEventImage(imgKey: string) {
    this.setState((state, props) => ({
      eventImgKey: state.eventImgKey === imgKey ? '' : imgKey,
      isEventNameValid: validateGeneralInput(state.eventName, 1, 40, '- _/#'),
      isEventDescriptionValid: validateGeneralInput(state.eventDescription, 1, 40, '- _/#'),
      isEventSmsValid: validatePhoneNumber(state.eventSms, true),
      isEventEmailValid: validateEmailAddress(state.eventEmail, true),
      isEventTypeValid: validateGeneralInput(state.eventType, 0, 40, '- _/'),
      isEventAliasValid: validateGeneralInput(state.eventAlias, 0, 40, '- _/')
    }));
  }

  /**
   * Returns a boolean indicating whether this component is editing an existing
   * event or adding a new one
   */
  isEditMode(): boolean {
    // Event ID that is in the URL
    const { eventId } = this.props.match.params;

    // Data for the event that matches the above Event ID
    const { event } = this.state;

    if (event && event.id === eventId) {
      return true;
    }

    return false;
  }

  /**
   * Handles all form input
   * @param evt Event handler for the form element's onChange function
   */
  handleFormInputChange(evt: any) {
    try {
      switch (evt.target.id) {
        case 'eventName':
          this.setState({ eventName: evt.target.value });
          break;
        case 'eventDescription':
          this.setState({ eventDescription: evt.target.value });
          break;
        case 'eventSms':
          this.setState({ eventSms: evt.target.value });
          break;
        case 'eventEmail':
          this.setState({ eventEmail: evt.target.value });
          break;
        case 'eventPriority':
          this.setState({ eventPriority: evt.target.value });
          break;
        case 'eventType':
          this.setState({ eventType: evt.target.value });
          break;
        case 'eventAlias':
          this.setState({ eventAlias: evt.target.value });
          break;
        case 'allRootCauseCheckbox':
          this.handleAllRootCauseCheckboxFormInputChange(evt);
          break;
        case 'rootCauseFilterTextBox':
          this.handleRootCauseFilterTextBoxFormInputChange(evt);
          break;
        default:
          if ((evt.target.id as string).startsWith('sub-event-')) {
            // Name of a "to be added" sub event
            this.handleSubEventFormInputChange(evt);
          } else {
            // Default behavior for individual root cause checkboxes
            this.handleIndividualRootCauseCheckboxFormInputChange(evt);
          }

          break;
      }

      this.setState((state, props) => ({
        isEventNameValid: validateGeneralInput(state.eventName, 1, 40, '- _/#'),
        isEventDescriptionValid: validateGeneralInput(state.eventDescription, 1, 40, '- _/#'),
        isEventSmsValid: validatePhoneNumber(state.eventSms, true),
        isEventEmailValid: validateEmailAddress(state.eventEmail, true),
        isEventTypeValid: validateGeneralInput(state.eventType, 0, 40, '- _/'),
        isEventAliasValid: validateGeneralInput(state.eventAlias, 0, 40, '- _/')
      }));
    } catch (err) {
      LOGGER.error('Error while handling form input change', err);
    }
  }

  /**
   * Handles form input change for the "select all root cause" checkbox
   * @param evt Event handler for the form element's onChange function
   */
  handleAllRootCauseCheckboxFormInputChange(evt: any) {
    for (const rootCause of this.state.rootCauses.filter(rc => rc.visible)) {
      if (evt.target.checked) {
        this.rootCauses = this.getUniqueRootCauses([...this.rootCauses, rootCause.name]);
      } else {
        const index = this.rootCauses.findIndex((removedRootCause: string) => removedRootCause === rootCause.name);
        this.rootCauses = [...this.rootCauses.slice(0, index), ...this.rootCauses.slice(index + 1)];
      }
    }

    this.setState({ selectAllRootCauses: evt.target.checked });
  }

  /**
   * Handles form input change for a root cause checkbox
   * @param evt Event handler for the form element's onChange function
   */
  handleIndividualRootCauseCheckboxFormInputChange(evt: any) {
    const checkedRootCause = JSON.parse(evt.target.id);

    if (evt.target.checked) {
      this.rootCauses.push(checkedRootCause.rootCause);
    } else {
      const index = this.rootCauses.findIndex((removedRootCause: string) => removedRootCause === checkedRootCause.rootCause);
      this.rootCauses = [...this.rootCauses.slice(0, index), ...this.rootCauses.slice(index + 1)];
    }

    // Compare if visible root causes are all checked.
    const visibleRootCauses = this.state.rootCauses.filter((rootCause: IRootCause) => rootCause.visible);
    const filteredCheckedRootCauses = this.rootCauses.filter((rootCause: string) => {
      const index = visibleRootCauses.findIndex((visibleRootCause: IRootCause) => visibleRootCause.name === rootCause);
      return index > -1;
    });

    this.setState({ selectAllRootCauses: visibleRootCauses.length > 0 && visibleRootCauses.length === filteredCheckedRootCauses.length });
  }

  /**
   * Handles form input change the text box that filters the displayed root causes
   * @param evt Event handler for the form element's onChange function
   */
  handleRootCauseFilterTextBoxFormInputChange(evt: any) {
    let { rootCauses } = this.state;

    for (let rootCause of rootCauses) {
      rootCause.visible = (evt.target.value === '' || rootCause.name.toLowerCase().includes(evt.target.value.toLowerCase()));
    }

    this.setState({
      rootCauses,
      rootCauseSearchKeyword: evt.target.value
    });
  }

  /**
   * Handles form input change for the text box for a sub event's name
   * @param evt Event handler for the form element's onChange function
   */
  handleSubEventFormInputChange(evt: any) {
    const toBeAddedSubEvents = this.state.toBeAddedSubEvents;
    const idx = toBeAddedSubEvents.findIndex(e => e.id === (evt.target.id as string).replace('sub-event-', ''));
    if (idx > -1) {
      const subEvent = toBeAddedSubEvents[idx];
      subEvent.name = evt.target.value;
      toBeAddedSubEvents[idx] = subEvent;
      this.setState({ toBeAddedSubEvents: [...toBeAddedSubEvents] });
    }
  }

  /**
   * Returns a boolean for whether the form is valid and can be submitted
   */
  shouldAllowFormSubmit(): boolean {
    if (this.state.showSubEventModal) {
      if (this.state.isFatalError || this.state.isLoading) { return false; }

      // Make sure all the "to be added" events have valid names
      return this.state.toBeAddedSubEvents.every(e => validateGeneralInput(e.name, 0, 40, '- _/#'));
    }

    return (
      !this.state.isFatalError &&
      !this.state.isLoading &&
      this.state.isEventNameValid &&
      this.state.isEventDescriptionValid &&
      this.state.isEventSmsValid &&
      this.state.isEventEmailValid &&
      this.state.isEventTypeValid &&
      this.state.isEventAliasValid
    );
  }

  /**
   * Submits the main form and either edits or adds a new event
   */
  async doMainFormSubmit() {
    if (!this.shouldAllowFormSubmit) { return; }

    if (this.isEditMode()) {
      await this.editEvent();
    } else {
      await this.addEvent();
    }

    // Redirect back to the process page
    this.props.history.push(`/processes/${this.state.processId}`);
  }

  /**
   * Submits the sub event form. "To be deleted" sub events are deleted and "to be added"
   * sub events are created
   */
  async doSubEventFormSubmit() {
    if (!this.shouldAllowFormSubmit) { return; }

    this.setState({ isModalProcessing: true });

    try {
      // Delete any sub events that are marked for deletion
      for (const subEvent of this.state.toBeDeletedSubEvents) {
        await this.graphQlCommon.deleteEvent(subEvent.id!);
      }

      for (const subEvent of this.state.toBeAddedSubEvents.filter(e => e.name.trim() !== '')) {
        await this.addSubEvent(subEvent);
      }

      for (const subEvent of this.state.existingSubEvents.filter(e => this.state.modifiedExistingSubEventIds.includes(e.id!))) {
        await this.editSubEvent(subEvent);
      }

      this.props.handleNotification(I18n.get('info.sub.events.updated'), 'info', 5);
      this.setState({ isModalProcessing: false, showSubEventModal: false });
    } catch (error: any) {
      let message = I18n.get('error.sub.event.manage');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        } else if (errorType === 'DataDuplicatedError') {
          message = I18n.get('error.duplicate.event.name');
        }
      }

      LOGGER.error('Error while managing sub events', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Opens the sub event modal after loading the sub events for the current root event
   */
  async openSubEventModal(): Promise<void> {
    if (!this.isEditMode()) { return; }

    this.setState({
      showSubEventModal: true,
      isModalProcessing: true,
      existingSubEvents: [],
      toBeDeletedSubEvents: [],
      toBeAddedSubEvents: [],
      imageSelectSubEventId: ''
    });

    const existingSubEvents: IEvent[] = await this.loadSubEvents(this.state.processId);
    existingSubEvents.sort((a, b) => a.name.localeCompare(b.name));

    // Create a new 'to be added' event, which will show the empty
    // text box in the modal
    const defaultToBeAddedEventPlaceholder = this.createNewToBeAddedSubEvent(this.state.event!.id!);

    this.setState({
      existingSubEvents: [...existingSubEvents],
      toBeAddedSubEvents: [defaultToBeAddedEventPlaceholder],
      isModalProcessing: false
    });
  }

  /**
   * Loads all events for the current process and returns a filtered list of events that are
   * nested under the currently displayed root event
   * @param {string} processId The ID of the process to load events for
   * @returns {IEvent[]} A list of events
   */
  async loadSubEvents(processId: string): Promise<IEvent[]> {
    const response: IEvent[] = await this.graphQlCommon.listEventsInProcess(processId);
    return this.getAllSubEventsWithCommonAncestor(this.state.event!.id!, response);
  }

  /**
   * Filters a list of events and returns all sub events nested under the supplied
   * parent event
   * @param {string} parentId The ID of the parent event to filter by
   * @param {IEvent[]} subEvents A list of events that will be filtered
   * @returns {IEvent[]} A list of events
   */
  getAllSubEventsWithCommonAncestor(parentId: string, subEvents: IEvent[]): IEvent[] {
    const output: IEvent[] = [];
    const childSubEvents = subEvents.filter(e => e.parentId === parentId);

    for (const subEvent of childSubEvents) {
      output.push(subEvent);
      output.push(...this.getAllSubEventsWithCommonAncestor(subEvent.id!, subEvents))
    }

    return output;
  }

  /**
   * Displays the sub events in the Modal differently depending on whether they are to be added,
   * to be deleted, or existing
   * @param {string} parentId The ID of the parent event to filter by
   * @param {number} indent A number representing how deep in the nested event tree we are currently displaying
   * @returns {JSX.Element[]} A list of JSX elements to be displayed in the component
   */
  displaySubEvents(parentId: string, indent: number = 0): JSX.Element[] {
    if (!this.state.showSubEventModal) { return []; }

    const MAX_INDENT = 1;
    const output: JSX.Element[] = [];

    const children = [
      ...this.state.existingSubEvents.filter(subEvent => subEvent.parentId === parentId),
      ...this.state.toBeDeletedSubEvents.filter(subEvent => subEvent.parentId === parentId),
      ...this.state.toBeAddedSubEvents.filter(subEvent => subEvent.parentId === parentId)
    ];

    for (const child of children) {
      let listItemContent: JSX.Element;
      if (this.state.existingSubEvents.find(e => e.id === child.id)) {
        // If this is an existing sub event, only option is to mark it for deletion or add a sub event under it
        listItemContent = (<>
          {
            child.eventImgKey &&
            <div className="sub-event-image-thumbnail-container">
              <AmplifyS3Image
                key={`sub-event-image-${child.eventImgKey}`}
                className="amplify-s3-image"
                imgKey={child.eventImgKey} />
            </div>
          }
          <div className="sub-event-name-container">{child.name}</div>
          <div className="sub-event-button-container">
            {indent < MAX_INDENT && (<Button id={`add-new-sub-event-button-${child.id}`} variant="outline-dark" onClick={() => this.addNewSubEventRow(child.id!)} disabled={(indent >= MAX_INDENT)}>{I18n.get('button.add.sub.event')}</Button>)}
            <Button id={`add-new-sub-event-image-button-${child.id}`} variant="outline-dark" onClick={() => this.showSubEventImageSelect(child.id!)}>{I18n.get('text.event.image')}</Button>
            <Button id={`delete-sub-event-button-${child.id}`} variant="outline-dark" onClick={() => this.markSubEventForDeletion(child.id!)}><GoX /></Button>
          </div>
        </>);
      } else if (this.state.toBeDeletedSubEvents.find(e => e.id === child.id)) {
        // If this sub event is marked for deletion, only option is to un-mark it for deletion
        listItemContent = (
          <div className="sub-event-name-container">
            <span className="sub-event-to-be-deleted">{child.name}</span> (To be deleted)
          </div>
        );
      } else {
        // If this is the final "to be added" sub event at this level and no other "to be added" sub events (including this one)
        // have invalid input, show a button to add a new sub event at this level
        let addButton;
        const toBeAddedSubEvents = this.state.toBeAddedSubEvents.filter(subEvent => subEvent.parentId === parentId);
        const allToBeAddedSubEventsValidName = toBeAddedSubEvents.every(e => validateGeneralInput(e.name, 1, 40, '- _/#'));
        const isFinalInList = toBeAddedSubEvents[toBeAddedSubEvents.length - 1]!.id === child.id;

        if (allToBeAddedSubEventsValidName && isFinalInList) {
          addButton = (
            <Button
              id={`sub-event-button-${child.id}`}
              variant="outline-dark"
              onClick={() => this.addNewSubEventRow(child.parentId!)}
              disabled={this.state.toBeAddedSubEvents.filter(subEvent => subEvent.parentId === parentId).some(e => e.name.trim() === '')}
            >{I18n.get('button.add.event')}</Button>
          );
        }

        // If this is a to be added sub event, show a text box so the name can be input
        listItemContent = (
          <>
            <div className="new-sub-event-name-container">
              <Form.Group as={Col} md={6} controlId={`sub-event-${child.id}`} className="sub-event-modal-form-group">
                <Form.Label>{I18n.get('text.sub.event.new')} <span className="required-field">*</span></Form.Label>
                <Form.Control required
                  type="text"
                  value={child.name}
                  placeholder={I18n.get('text.sub.event.name')}
                  onChange={this.handleFormInputChange}
                  className={getInputFormValidationClassName(child.name, validateGeneralInput(child.name, 0, 40, '- _/#'))}
                />
                <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
              </Form.Group>
            </div>
            <div className="sub-event-button-container">
              {
                indent < MAX_INDENT &&
                (
                  <Button
                    id={`add-new-sub-event-button-${child.id}`}
                    variant="outline-dark"
                    onClick={() => this.addNewSubEventRow(child.id!)}
                    disabled={(indent >= MAX_INDENT) || !validateGeneralInput(child.name, 1, 40, '- _/#')}>{I18n.get('button.add.sub.event')}</Button>
                )
              }
              <Button
                id={`add-new-sub-event-image-button-${child.id}`}
                variant="outline-dark"
                onClick={() => this.showSubEventImageSelect(child.id!)}
                disabled={!validateGeneralInput(child.name, 1, 40, '- _/#')}
              >{I18n.get('text.event.image')}</Button>
              {addButton}
            </div>
          </>
        );
      }

      let subEventImgContent;

      if (this.state.imageSelectSubEventId === child.id) {
        subEventImgContent = (
          <div className="sub-event-image-select-container">
            <div className="sub-event-image-library-container">
              {this.state.eventImgKeys.map(imgKey => {
                return (
                  <AmplifyS3Image
                    key={`library-img-${imgKey}`}
                    className={`amplify-s3-image event-image ${imgKey === child.eventImgKey ? 'selected' : ''}`}
                    imgKey={imgKey}
                    onClick={() => this.onSelectSubEventImage(imgKey)}>
                  </AmplifyS3Image>
                )
              })}
            </div>
            <div className="sub-event-image-button-container">
              <div className="div-upload-new-image-button" key="div-upload-new-image-button">
                <Button id="upload-new-image" variant="outline-primary" disabled={this.state.isLoading || this.state.isModalProcessing}>{I18n.get('text.event.image.upload')}</Button>
                <input
                  title={I18n.get('text.event.image.upload')}
                  type="file"
                  accept="image/*"
                  onChange={this.onPickImageToUpload}
                  disabled={this.state.isLoading || this.state.isModalProcessing}
                />
              </div>
            </div>
          </div>
        );
      }

      output.push(
        <ListGroup.Item key={`sub-event-${child.id}`}>
          <div className={`sub-event-list-indent-${indent}`}>
            {listItemContent}
            {subEventImgContent}
          </div>
        </ListGroup.Item>
      );

      // Append any children of this child event
      output.push(...this.displaySubEvents(child.id!, indent + 1));
    }

    return output;
  }

  /**
   * Shows the event image selection option for the supplied sub event
   * @param subEventId ID of the sub event for which an image will be selected
   */
  showSubEventImageSelect(subEventId: string): void {
    this.setState((state, props) => ({
      imageSelectSubEventId: subEventId === state.imageSelectSubEventId ? '' : subEventId
    }));
  }

  /**
   * Assigns the supplied S3 image key with the sub event
   * @param imgKey The S3 image key of the selected image
   */
  onSelectSubEventImage(imgKey: string): void {
    const existingSubEvents = this.state.existingSubEvents;
    const existingIdx = existingSubEvents.findIndex(e => e.id === this.state.imageSelectSubEventId);

    if (existingIdx > -1) {
      const subEvent = existingSubEvents[existingIdx];
      subEvent.eventImgKey = subEvent.eventImgKey === imgKey ? '' : imgKey;
      existingSubEvents[existingIdx] = subEvent;

      const modifiedExistingSubEventIds = this.state.modifiedExistingSubEventIds;

      this.setState({
        existingSubEvents: [...existingSubEvents],
        modifiedExistingSubEventIds: Array.from(new Set<string>([...modifiedExistingSubEventIds, this.state.imageSelectSubEventId]))
      });

      // No need to check the to be added sub events if we matched the ID to an existing sub event
      return;
    }

    const toBeAddedSubEvents = this.state.toBeAddedSubEvents;
    const toBeAddedIdx = toBeAddedSubEvents.findIndex(e => e.id === this.state.imageSelectSubEventId);

    if (toBeAddedIdx > -1) {
      const subEvent = toBeAddedSubEvents[toBeAddedIdx];
      subEvent.eventImgKey = subEvent.eventImgKey === imgKey ? '' : imgKey;
      toBeAddedSubEvents[toBeAddedIdx] = subEvent;

      this.setState({ toBeAddedSubEvents: [...toBeAddedSubEvents] });
    }
  }

  /**
   * Marks the sub event with the supplied ID for deletion as well as any sub events that
   * are nested underneath it
   * @param {string} subEventId The ID for sub event to be deleted
   */
  markSubEventForDeletion(subEventId: string) {
    // Mark any children of this sub event for deletion
    const childSubEventIds: string[] = [];

    for (const e of this.state.existingSubEvents) {
      if (e.parentId === subEventId) {
        childSubEventIds.push(e.id!);
      }
    }

    for (const e of this.state.toBeAddedSubEvents) {
      if (e.parentId === subEventId) {
        childSubEventIds.push(e.id!);
      }
    }

    for (const childSubEventId of childSubEventIds) {
      this.markSubEventForDeletion(childSubEventId);
    }

    // Mark this sub event for deletion
    const idx = this.state.existingSubEvents.findIndex(e => e.id === subEventId);

    if (idx > -1) {
      const subEvent = this.state.existingSubEvents[idx];

      this.setState((state, props) => ({ toBeDeletedSubEvents: [...state.toBeDeletedSubEvents, subEvent] }));
    }

    this.setState((state, props) => ({
      existingSubEvents: [...state.existingSubEvents.filter(e => e.id !== subEventId)],
      toBeAddedSubEvents: [...state.toBeAddedSubEvents.filter(e => e.id !== subEventId)]
    }));
  }

  /**
   * Adds a row for a new sub event under the event with the supplied parent ID
   * @param parentId The ID of the event that will serve as the new sub event's parent
   */
  addNewSubEventRow(parentId: string) {
    this.setState((state, props) => ({
      toBeAddedSubEvents: [...state.toBeAddedSubEvents, this.createNewToBeAddedSubEvent(parentId)]
    }));
  }

  /**
   * Creates a new sub event that will be added
   * @param parentId ID of the event the new sub event will be nested under
   * @returns {IEvent} new Event object
   */
  createNewToBeAddedSubEvent(parentId: string): IEvent {
    return {
      id: uuid.v4(),
      parentId,
      name: '',
      description: '',
      priority: this.state.event!.priority,
      type: this.state.event!.type
    };
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
                  <Breadcrumb.Item>{I18n.get('text.sites')}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{I18n.get('text.areas')}: {this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/areas/${this.state.areaId}/processes`} exact>
                  <Breadcrumb.Item>{I18n.get('info.processes')}: {this.state.areaName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/processes/${this.state.processId}`} exact>
                  <Breadcrumb.Item>{I18n.get('text.events')}: {this.state.processName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>
                  {I18n.get(`${!this.isEditMode() ? 'button.add.event' : 'text.edit.event'}`)}
                </Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <EmptyRow />
          {
            this.state.error &&
            <Row>
              <Col>
                <Alert variant="danger">
                  <strong>{I18n.get('error')}:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
          {!this.state.isPageLoading && !this.state.isFatalError &&
            <Row>
              <Col>
                <Card>
                  <Card.Body>
                    <Card.Title>
                      <Form.Row className="justify-content-between">
                        <div>{this.isEditMode() ? I18n.get('text.edit.event') : I18n.get('button.add.event')}</div>
                        <div>{this.isEditMode() && <Button id="manageSubEventsButton" variant="primary" onClick={this.openSubEventModal} >{I18n.get('button.manage.sub.events')}</Button>}</div>
                      </Form.Row>
                    </Card.Title>
                    <Card.Text as="div">
                      <Form>
                        <Form.Row>
                          <Form.Group as={Col} md={6} controlId="eventName">
                            <Form.Label>{I18n.get('text.event.name')} <span className="required-field">*</span></Form.Label>
                            <Form.Control required
                              type="text"
                              placeholder={I18n.get('input.event.nat')}
                              value={this.state.eventName}
                              onChange={this.handleFormInputChange}
                              className={!this.isEditMode() ? getInputFormValidationClassName(this.state.eventName, this.state.isEventNameValid) : ''}
                              disabled={this.isEditMode() || this.state.isLoading}
                            />
                            {
                              !this.isEditMode() &&
                              <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                            }
                          </Form.Group>
                          <Form.Group as={Col} md={6} controlId="eventDescription">
                            <Form.Label>{I18n.get('text.event.description')} <span className="required-field">*</span></Form.Label>
                            <Form.Control required
                              type="text"
                              placeholder={I18n.get('input.event.description')}
                              value={this.state.eventDescription}
                              onChange={this.handleFormInputChange}
                              className={!this.isEditMode() ? getInputFormValidationClassName(this.state.eventDescription, this.state.isEventDescriptionValid) : ''}
                              disabled={this.isEditMode() || this.state.isLoading}
                            />
                            {
                              !this.isEditMode() &&
                              <Form.Text className="text-muted">{`(${I18n.get('text.required')}) ${I18n.get('info.valid.general.input')}`}</Form.Text>
                            }
                          </Form.Group>
                        </Form.Row>
                        <Form.Row>
                          <Form.Group as={Col} md={6} controlId="eventSms">
                            <Form.Label>{I18n.get('text.sms.no')}</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder={I18n.get('input.sms')}
                              value={this.state.eventSms}
                              onChange={this.handleFormInputChange}
                              className={getInputFormValidationClassName(this.state.eventSms, this.state.isEventSmsValid)}
                              disabled={this.state.isLoading}
                            />
                            <Form.Text className="text-muted">{`(${I18n.get('text.optional')}) ${I18n.get('info.valid.phone.number')}`}</Form.Text>
                          </Form.Group>
                          <Form.Group as={Col} md={6} controlId="eventEmail">
                            <Form.Label>{I18n.get('text.email')}</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder={I18n.get('input.group.email')}
                              value={this.state.eventEmail}
                              onChange={this.handleFormInputChange}
                              className={getInputFormValidationClassName(this.state.eventEmail, this.state.isEventEmailValid)}
                              disabled={this.state.isLoading}
                            />
                            <Form.Text className="text-muted">{`(${I18n.get('text.optional')}) ${I18n.get('info.valid.email')}`}</Form.Text>
                          </Form.Group>
                        </Form.Row>
                        {
                          !this.isEditMode() &&
                          <div>
                            <Form.Row>
                              <Form.Group as={Col} md={6} controlId="eventPriority">
                                <Form.Label>{I18n.get('text.event.priority')} <span className="required-field">*</span></Form.Label>
                                <Form.Control as="select" value={this.state.eventPriority} onChange={this.handleFormInputChange} disabled={this.state.isLoading}>
                                  <option value={EventPriority.Low}>{I18n.get('text.priority.low')}</option>
                                  <option value={EventPriority.Medium}>{I18n.get('text.priority.medium')}</option>
                                  <option value={EventPriority.High}>{I18n.get('text.priority.high')}</option>
                                  <option value={EventPriority.Critical}>{I18n.get('text.priority.critical')}</option>
                                </Form.Control>
                              </Form.Group>
                              <Form.Group as={Col} md={6} controlId="eventType">
                                <Form.Label>{I18n.get('text.event.type')}</Form.Label>
                                <Form.Control required
                                  type="text"
                                  placeholder={I18n.get('input.event.type')}
                                  value={this.state.eventType}
                                  onChange={this.handleFormInputChange}
                                  className={getInputFormValidationClassName(this.state.eventType, this.state.isEventTypeValid)}
                                  disabled={this.state.isLoading}
                                />
                                <Form.Text className="text-muted">{`(${I18n.get('text.optional')}) ${I18n.get('info.valid.event.type')}`}</Form.Text>
                              </Form.Group>
                            </Form.Row>
                          </div>
                        }
                        <Form.Row>
                          <Form.Group as={Col} md={6} controlId="eventAlias">
                            <Form.Label>{I18n.get('text.event.alias')}</Form.Label>
                            <Form.Control required
                              type="text"
                              placeholder={I18n.get('input.event.alias')}
                              value={this.state.eventAlias}
                              onChange={this.handleFormInputChange}
                              className={getInputFormValidationClassName(this.state.eventAlias, this.state.isEventAliasValid)}
                              disabled={this.state.isLoading}
                            />
                            <Form.Text className="text-muted">{`(${I18n.get('text.optional')}) ${I18n.get('info.valid.event.alias')}`}</Form.Text>
                          </Form.Group>
                        </Form.Row>
                        <Form.Row>
                          <Form.Label>{I18n.get('text.rootcauses')}</Form.Label>
                          <Table striped bordered>
                            <thead>
                              <tr>
                                <th className="fixed-th-20">
                                  <Form.Check type="checkbox" id="allRootCauseCheckbox" checked={this.state.selectAllRootCauses} onChange={this.handleFormInputChange} disabled={this.state.isLoading} />
                                </th>
                                <th>
                                  <Form.Group className="form-group-no-margin" controlId="rootCauseFilterTextBox">
                                    <Form.Control
                                      size="sm"
                                      type="text"
                                      placeholder={I18n.get('text.search.rootcause')}
                                      onChange={this.handleFormInputChange}
                                      disabled={this.state.isLoading}
                                    />
                                  </Form.Group>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {
                                this.state.rootCauses.filter((rootCause: IRootCause) => rootCause.visible)
                                  .map((rootCause: IRootCause) => {
                                    const rootCauseId = JSON.stringify({ id: rootCause.id, rootCause: rootCause.name });
                                    const isRootCauseChecked: boolean = this.rootCauses.findIndex((checkedRootCause: string) => checkedRootCause === rootCause.name) > -1;

                                    return (
                                      <tr key={rootCause.id}>
                                        <td>
                                          <Form.Check type="checkbox" id={rootCauseId} checked={isRootCauseChecked} onChange={this.handleFormInputChange} disabled={this.state.isLoading} />
                                        </td>
                                        <td>{rootCause.name}{rootCause.deleted ? ` (${I18n.get('text.deleted')})` : ''}</td>
                                      </tr>
                                    );
                                  })
                              }
                            </tbody>
                          </Table>
                        </Form.Row>
                        <Form.Row>
                          <Form.Label>{I18n.get('text.event.image')}</Form.Label>
                          <Table striped bordered>
                            <thead>
                              <tr>
                                <th className="fixed-th-150">
                                  {
                                    this.state.eventImgKey
                                      ? <AmplifyS3Image key={`event-image-${this.state.eventImgKey}`} className="amplify-s3-image event-image" imgKey={this.state.eventImgKey}></AmplifyS3Image>
                                      : <div key="empty-event-image"></div>
                                  }
                                </th>
                                <th>
                                  <div className="div-select-from-image-library-button" key="div-select-from-image-library-button">
                                    <Button
                                      id="imageSelect"
                                      variant="primary"
                                      onClick={this.toggleEventImageLibrary}
                                      disabled={this.state.isLoading || (this.state.eventImgKeys && this.state.eventImgKeys.length === 0)}>
                                      {I18n.get('text.event.image.select')}
                                    </Button>
                                  </div>
                                  <div className="div-upload-new-image-button" key="div-upload-new-image-button">
                                    <Button id="uploadImageButton" variant="primary" disabled={this.state.isLoading}>{I18n.get('text.event.image.upload')}</Button>
                                    <input
                                      id="uploadImageInput"
                                      title={I18n.get('text.event.image.upload')}
                                      type="file"
                                      accept="image/*"
                                      onChange={this.onPickImageToUpload}
                                      disabled={this.state.isLoading}
                                    />
                                  </div>
                                </th>
                              </tr>
                            </thead>
                          </Table>
                        </Form.Row>
                        <Form.Row>
                          {
                            this.state.showEventImageLibrary
                              ?
                              this.state.eventImgKeys.map(imgKey => {
                                return (
                                  <AmplifyS3Image
                                    key={`library-img-${imgKey}`}
                                    className={`amplify-s3-image event-image ${imgKey === this.state.eventImgKey ? 'selected' : ''}`}
                                    imgKey={imgKey}
                                    onClick={() => this.onSelectEventImage(imgKey)}>
                                  </AmplifyS3Image>
                                )
                              })
                              : <div key="empty-event-image-library"></div>
                          }
                        </Form.Row>
                        <Form.Row className="justify-content-between">
                          <Button id="eventCancel" variant="secondary" onClick={() => this.props.history.push(`/processes/${this.state.processId}`)}>{I18n.get('button.cancel')}</Button>
                          <Button id="eventSave" variant="primary" onClick={() => this.doMainFormSubmit()} disabled={!this.shouldAllowFormSubmit()}>{I18n.get('button.save')}</Button>
                        </Form.Row>
                      </Form>
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          }
          {
            (this.state.isLoading || this.state.isPageLoading) &&
            <Row>
              <Col>
                <ProgressBar animated now={100} />
              </Col>
            </Row>
          }
        </Container>
        <Modal show={this.state.showSubEventModal} onHide={() => this.setState({ showSubEventModal: false })}>
          <Modal.Header>
            <Modal.Title>{I18n.get('button.manage.sub.events')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {
              !this.state.isModalProcessing && this.state.existingSubEvents.length === 0 &&
              <h5 id="subEventsEmptyState">{I18n.get('text.sub.event.empty')}</h5>
            }
            <ListGroup variant="flush">
              {
                this.isEditMode() &&
                this.displaySubEvents(this.state.event!.id!)
              }
            </ListGroup>
            {
              this.state.isModalProcessing &&
              <ProgressBar animated now={100} />
            }
          </Modal.Body>
          <Modal.Footer>
            <Button id="subEventCancel" variant="secondary" onClick={() => this.setState({ showSubEventModal: false })}>{I18n.get('button.close')}</Button>
            <Button id="subEventSave" variant="primary" disabled={!this.shouldAllowFormSubmit()} onClick={() => this.doSubEventFormSubmit()}>{I18n.get('button.save')}</Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default AddEditEvent;