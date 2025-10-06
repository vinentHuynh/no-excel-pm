import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-2_your_user_pool_id', // Replace with your User Pool ID
  ClientId: 'your_client_id', // Replace with your Client ID
};

export default new CognitoUserPool(poolData);
