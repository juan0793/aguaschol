import {
  awardProfileAchievement,
  deleteGeneralProfileMessage,
  getProfile,
  markProfileMessageRead,
  sendGeneralProfileMessage,
  sendProfileMessage,
  updateGeneralProfileMessagePin
} from "../services/profileService.js";
import { emitProfileMessage } from "../services/profileRealtimeService.js";
import { saveUploadedPhoto } from "../services/fileStorageService.js";

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

export const sendGeneralProfileMessageHandler = async (req, res, next) => {
  try {
    let attachmentUrl = "";
    let attachmentType = "";

    if (req.file) {
      if (!String(req.file.mimetype || "").startsWith("image/")) {
        return res.status(400).json({ message: "Solo se permiten imagenes en el chat." });
      }

      const saved = await saveUploadedPhoto(req.file);
      attachmentUrl = saved.photoPath;
      attachmentType = "image";
    }

    const result = await sendGeneralProfileMessage({
      authUser: req.authUser,
      body: req.body?.body,
      channel: req.body?.channel,
      attachmentUrl,
      attachmentType
    });
    res.status(201).json(result);
    emitProfileMessage(result.message);
    result.notifications.forEach((notification) => emitProfileMessage(notification));
  } catch (error) {
    next(error);
  }
};

export const updateGeneralProfileMessagePinHandler = async (req, res, next) => {
  try {
    const message = await updateGeneralProfileMessagePin({
      authUser: req.authUser,
      messageId: req.params.id,
      pinned: req.body?.pinned !== false
    });
    res.json(message);
    emitProfileMessage(message);
  } catch (error) {
    next(error);
  }
};

export const deleteGeneralProfileMessageHandler = async (req, res, next) => {
  try {
    const result = await deleteGeneralProfileMessage({
      authUser: req.authUser,
      messageId: req.params.id
    });
    res.json(result);
    emitProfileMessage({ is_general: true, deleted_id: result.id });
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
