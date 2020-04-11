const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.OnCreateUser = functions.auth.user().onCreate(async (user) => {
  const resultCreate = await admin
    .firestore()
    .collection('Users')
    .doc(user.uid)
    .set({
      displayName: user.displayName || '',
      email: user.email || '',
      emailVerified: user.emailVerified || false,
      isAnonymous: user.isAnonymous || false,
      metadata: {
        creationTime: new admin.firestore.Timestamp(
          new Date(user.metadata.creationTime).getTime() / 1000,
          0,
        ),
        lastSignInTime: new admin.firestore.Timestamp(
          new Date(user.metadata.lastSignInTime).getTime() / 1000,
          0,
        ),
      },
      phoneNumber: user.phoneNumber,
      photoURL: user.photoURL || '',
      isOnline: true,
    });
  return resultCreate;
});

exports.updateUser = functions.https.onCall(async (dataUser, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must login first',
    );
  }
  const resultUpdate = await admin
    .firestore()
    .collection('Users')
    .doc(context.auth.uid)
    .update(dataUser);
  if (resultUpdate) {
    return (
      await admin.firestore().collection('Users').doc(context.auth.uid).get()
    ).data();
  } else {
    console.log(resultUpdate);
    throw new functions.https.HttpsError('aborted', 'Something Wrong');
  }
});

exports.userSignOut = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You Not SignIn');
  }
  return await admin
    .firestore()
    .collection('Users')
    .doc(context.auth.uid)
    .update({
      isOnline: false,
    });
});

exports.onDeleteUser = functions.auth.user().onDelete(async (user) => {
  return await admin.firestore().collection('Users').doc(user.uid).delete();
});

exports.getOrCreateRoom = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You Not SignIn');
  }
  const getRoom = await admin
    .firestore()
    .collection('RoomChat')
    .where(`member.${context.auth.uid}`, '==', true)
    .where(`member.${data.secondUser}`, '==', true)
    .where('type', '==', 'DIRECT_MESSAGE')
    .get();
  if (getRoom.empty) {
    const createRoom = await admin
      .firestore()
      .collection('RoomChat')
      .add({
        type: 'DIRECT_MESSAGE',
        member: {
          [context.auth.uid]: true,
          [data.secondUser]: true,
        },
      });
    await admin
      .firestore()
      .collection('Users')
      .doc(`${context.auth.uid}`)
      .collection('ListChat')
      .add({
        id: createRoom.id,
      });
    await admin
      .firestore()
      .collection('Users')
      .doc(`${data.secondUser}`)
      .collection('ListChat')
      .add({
        id: createRoom.id,
      });
    return createRoom.id;
  } else {
    let id = '';
    getRoom.docs.forEach((doc) => {
      id = doc.id;
    });
    return id;
  }
});

exports.createMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You Not SignIn');
  }
  admin
    .firestore()
    .collection('RoomChat')
    .doc(`${data.idRoom}`)
    .update({
      lastMessage: data.text,
      lastAddedMessage: new Date(data.createdAt).toUTCString(),
    });
  await admin
    .firestore()
    .collection('RoomMessage')
    .doc(`${data.idRoom}`)
    .collection('messages')
    .add({
      user: context.auth.uid,
      text: data.text,
      createdAt: new Date(data.createdAt).toUTCString(),
    });
  return true;
});
