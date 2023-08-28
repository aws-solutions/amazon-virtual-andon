// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

declare module 'aws-amplify-react' {
    interface IAuthProps {
        authData?: any;
    }
    interface IForgotPasswordState {
        delivery: any;
    }
    interface IVerifyContactState {
        verifyAttr: any;
    }
    interface IAuthenticatorProps {
        hideDefault: boolean;
        amplifyConfig: any;
        errorMessage?: (message:string) => string;
        onStateChange: Function;
    }

    export declare class SignIn extends React.Component {
        _validAuthStates: string[];
        handleInputChange: React.EventHandler;
        changeState(state: string, data?: any): void;
        signIn(): void;
        error(error: any): void;
    }

    export declare class RequireNewPassword extends React.Component {
        _validAuthStates: string[];
        handleInputChange: React.EventHandler;
        changeState(state: string, data?: any): void;
        change(): void;
        error(error: any): void;
    }

    export declare class ForgotPassword extends React.Component<IAuthProps, IForgotPasswordState> {
        _validAuthStates: string[];
        handleInputChange: React.EventHandler;
        changeState(state: string, data?: any): void;
        send(): void;
        submit(): void;
        error(error: any): void;
    }

    export declare class VerifyContact extends React.Component<IAuthProps, IVerifyContactState> {
        _validAuthStates: string[];
        handleInputChange: React.EventHandler;
        changeState(state: string, data?: any): void;
        verify(): void;
        submit(): void;
        error(error: any): void;
    }

    export declare class Authenticator extends React.Component<IAuthenticatorProps> {
    }
}