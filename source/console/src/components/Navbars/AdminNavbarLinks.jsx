import React, { Component } from "react";
import {
  NavItem,
  Nav
} from "react-bootstrap";
import { Auth, Logger } from 'aws-amplify';

import configurations from "variables/configurations";

class AdminNavbarLinks extends Component {
  constructor(props) {
    super(props);

    this.handleSelect = this.handleSelect.bind(this);

    this.logger = new Logger(configurations.logger.name, configurations.logger.level);

    // Sets up initial state
    this.state = {
      alertsCount: 0,
      user: ''
    }
  }

  async componentDidMount() {
    const u = await Auth.currentUserInfo()
    const user = u.attributes.email
    this.setState({ user })
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  // Handles menu select
  handleSelect(eventKey) {
    if (eventKey === 'logout') {
      Auth.signOut({ global: true })
        .then(data => this.logger.debug("Logged out"))
        .catch(err => this.logger.error(err));
    }
  }

  render() {
    return (
      <div>
        <Nav pullRight onSelect={k => this.handleSelect(k)}>
          <NavItem href="/home">
            <i className="fa pe-7s-user" />{this.state.user}
          </NavItem>
          <NavItem eventKey={'logout'} href="#">
            <i className="fa pe-7s-power" />
            Sign Out
          </NavItem>
        </Nav>
      </div>
    );
  }
}

export default AdminNavbarLinks;
