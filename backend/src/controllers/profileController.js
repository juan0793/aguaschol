import {
  awardProfileAchievement,
  getProfile,
  markProfileMessageRead,
  sendProfileMessage
} from "../services/profileService.js";
import { emitProfileMessage } from "../services/profileRealtimeService.js";

export const getProfileHandler = async (req, res, next) => {
  try {
    const profile = await getProfile({
      authUser: req.authUser,
      userId: req.query.user_id
    });
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

export const sendProfileMessageHandler = async (req, res, next) => {
  try {
    const message = await sendProfileMessage({
      authUser: req.authUser,
      recipientUserId: req.body?.recipient_user_id,
      parentMessageId: req.body?.parent_message_id,
      body: req.body?.body
    });
    res.status(201).json(message);
    // Emitir evento WebSocket para entrega en tiempo real
    emitProfileMessage(message);
  } catch (error) {
    next(error);
  }
};

export const markProfileMessageReadHandler = async (req, res, next) => {
  try {
    const result = await markProfileMessageRead({
      authUser: req.authUser,
      messageId: req.params.id
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const awardProfileAchievementHandler = async (req, res, next) => {
  try {
    const achievement = await awardProfileAchievement({
      authUser: req.authUser,
      userId: req.body?.user_id,
      title: req.body?.title,
      description: req.body?.description,
      icon: req.body?.icon,
      badgeColor: req.body?.badge_color
    });
    res.status(201).json(achievement);
  } catch (error) {
    next(error);
  }
};
