// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { Cookies } from 'react-cookie';
import { I18n } from 'aws-amplify';

// Import React Bootstrap components
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import {Buffer} from 'buffer';

// Import custom setting
import EmptyCol from './EmptyCol';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps { }

/**
 * State Interface
 * @interface IState
 */
interface IState {
  showCookieBanner: boolean;
  cookieLanguageCode: string;
}

/**
 * Footer class returns the default footer HTML tags including copyright and AWS Solutions link.
 * @class Footer
 */
class Footer extends React.Component<IProps, IState> {
  private cookies: Cookies;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      showCookieBanner: false,
      cookieLanguageCode: ''
    };

    this.cookies = new Cookies();
    this.handleLanguageChange = this.handleLanguageChange.bind(this);
    this.handleCookieBanner = this.handleCookieBanner.bind(this);
  }

  /**
   * ComponentDidMount function.
   */
  componentDidMount() {
    const cookie = this.cookies.get('ui_cookie');
    if (!cookie) {
      this.setState({ showCookieBanner: true });
    }

    const localeCode = new Cookies().get('ui_locale');
    let cookieLanguageCode = localeCode;

    if (localeCode === 'ja') {
      cookieLanguageCode = 'jp';
    } else if (localeCode === 'zh') {
      cookieLanguageCode = 'cn';
    }

    this.setState({ cookieLanguageCode });
  }

  /**
   * Handle the language change. Each changes last for 20 years.
   * @param {any} event - Language change event
   */
  handleLanguageChange(event: any) {
    let cookieExpires = new Date();
    cookieExpires.setFullYear(cookieExpires.getFullYear() + 20);
    this.cookies.set('ui_locale', event.target.value, { expires: cookieExpires, path: '/', secure: true });
    window.location.reload();
  }

  /**
   * Handle cookie banner.
   */
  handleCookieBanner() {
    const cookie = Buffer.from(new Date().toISOString()).toString('base64');
    let cookieExpires = new Date();

    cookieExpires.setMonth(cookieExpires.getMonth() + 1);
    this.cookies.set('ui_cookie', cookie, { expires: cookieExpires, path: '/', secure: true });

    this.setState({ showCookieBanner: false });
  }

  /**
   * Render the footer page.
   */
  render() {
    return (
      <footer key="footer">
        {
          this.state.showCookieBanner &&
          <Navbar bg="dark" className="cookie-banner">
            <Navbar.Text id="info-cookie" className="cookie-banner-font">
              {I18n.get('info.cookie')}
              <EmptyCol />
              <Button id="dismiss-cookie" size="sm" variant="secondary" onClick={this.handleCookieBanner}>X</Button>
            </Navbar.Text>
          </Navbar>
        }
        <Navbar bg="light" fixed="bottom">
          <Navbar.Collapse className="justify-content-between">
            <Form inline>
              <Form.Control as="select" onChange={this.handleLanguageChange} defaultValue={new Cookies().get('ui_locale')} id="change-language">
                <option value="de">{I18n.get('select.german')}</option>
                <option value="en">{I18n.get('select.english')}</option>
                <option value="es">{I18n.get('select.spanish')}</option>
                <option value="fr">{I18n.get('select.french')}</option>
                <option value="ja">{I18n.get('select.japanese')}</option>
                <option value="ko">{I18n.get('select.korean')}</option>
                <option value="zh">{I18n.get('select.chinese')}</option>
                <option value="th">{I18n.get('select.thai')}</option>
              </Form.Control>
            </Form>
            <Nav>
              <Nav.Link id="solutions-link" href="https://aws.amazon.com/solutions/" target="_blank" rel="noopener noreferrer">{I18n.get('text.aws.solutions')}</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
      </footer>
    );
  }
}

export default Footer;