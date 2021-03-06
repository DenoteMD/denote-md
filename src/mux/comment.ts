import { Mux, IMuxRequest, IRequestData, IResponseList, IOrdering, IResponseRecord } from '../framework';
import { ModelArticle } from '../model/article';
import { IComment, ModelComment } from '../model/comment';
import {
  ValidatorGetArticle,
  ValidatorGetComment,
  ValidatorComment,
  ReplyValidatorComment,
  CommentUuidValidator,
} from '../validators';

// Get all comments at root level in article for a given article's UUID
Mux.get<IComment>(
  '/v1/comment/article/:articleUuid',
  ValidatorGetArticle,
  async (requestData: IRequestData): Promise<IResponseList<IComment>> => {
    const { offset, limit, order } = requestData.body;
    const { articleUuid } = requestData.params;
    const foundArticle = await ModelArticle.findOne({ uuid: articleUuid });
    if (foundArticle) {
      const orderObject = order.reduce((curObj: IOrdering, item: IOrdering) => {
        return {
          ...curObj,
          [item.column]: item.order,
        };
      }, {});

      const foundComments = (await ModelComment.find({ article: foundArticle._id, reply: undefined, hidden: false })
        .sort(orderObject)
        .skip(offset * limit)
        .limit(limit)
        .populate('author', '-_id -profile')
        .populate('article', '-_id -author')
        .select('-_id -reply -votedUser')
        .lean()) as [IComment];

      return {
        success: true,
        result: {
          limit,
          offset,
          records: foundComments,
          order,
          total: foundComments.length,
        },
      };
    }
    throw new Error("Can't find comment for this article");
  },
);

// Get all comments that's reply to a given comment UUID
Mux.get<IComment>(
  '/v1/comment/comment/:commentUuid',
  ValidatorGetComment,
  async (requestData: IRequestData): Promise<IResponseList<IComment>> => {
    const { commentUuid } = requestData.params;
    const { offset, limit, order } = requestData.body;

    const foundComment = await ModelComment.findOne({ uuid: commentUuid });
    if (foundComment) {
      const orderObject = order.reduce((curObj: IOrdering, item: IOrdering) => {
        return {
          ...curObj,
          [item.column]: item.order,
        };
      }, {});
      const replyComments = (await ModelComment.find({ reply: foundComment._id })
        .sort(orderObject)
        .skip(offset * limit)
        .limit(limit)
        .populate('author', '-_id -profile')
        .populate('article', '-_id -author')
        .select('-_id -reply -votedUser')
        .lean()) as [IComment];
      const totalReply = await ModelComment.countDocuments({ reply: foundComment._id });
      return {
        success: true,
        result: {
          limit,
          offset,
          records: replyComments,
          order,
          total: totalReply,
        },
      };
    }
    throw new Error("Can't find reply for given comment");
  },
);

// Add a comment at root level in an article base on article's uuid
Mux.post<IComment>(
  '/v1/comment/article/:articleUuid',
  ValidatorComment,
  async (requestData: IRequestData, req?: IMuxRequest): Promise<IResponseRecord<IComment>> => {
    const { articleUuid } = requestData.params;
    const { content } = requestData.body;

    if (req && req.session) {
      const article = await ModelArticle.findOne({ uuid: articleUuid });
      const user = req.session.getUser();
      if (user && article) {
        const imComment = new ModelComment({ content });
        imComment.author = user._id;
        imComment.article = article._id;
        const result = await imComment.save();

        const savedComment = await ModelComment.findById(result._id)
          .select('-_id')
          .populate('author', '-_id -profile')
          .populate('article', '-_id -author');

        if (savedComment) {
          const responseComment = <IComment>savedComment.toObject();
          return {
            success: true,
            result: {
              ...responseComment,
            },
          };
        }
      }
    }
    throw new Error('We are not able to save this comment');
  },
);

// Edit comment in article
Mux.put<IComment>(
  '/v1/comment/:articleUuid',
  ValidatorComment,
  async (requestData: IRequestData, req?: IMuxRequest): Promise<IResponseRecord<IComment>> => {
    const { articleUuid } = requestData.params;

    if (req && req.session) {
      const comment = await ModelComment.findOne({ uuid: articleUuid });
      const user = req.session.getUser();
      const { content } = requestData.body;
      if (comment && user) {
        if (comment.author.toString() === user._id.toString()) {
          const savedComment = await ModelComment.findByIdAndUpdate(comment._id, { content })
            .select('-_id')
            .populate('author', '-_id -profile')
            .populate('article', '-_id -author');
          if (savedComment) {
            const responseComment = <IComment>savedComment.toObject();
            return {
              success: true,
              result: {
                ...responseComment,
              },
            };
          }
        }
      }
    }
    throw new Error('We are not able to save comment');
  },
);

// Reply to a comment in an article base on article's uuid
Mux.post<IComment>(
  '/v1/comment/:commentUuid/article/:articleUuid',
  ReplyValidatorComment,
  async (requestData: IRequestData, req?: IMuxRequest): Promise<IResponseRecord<IComment>> => {
    const { commentUuid, articleUuid } = requestData.params;

    if (req && req.session) {
      const user = req.session.getUser();
      const foundArticle = await ModelArticle.findOne({ uuid: articleUuid });
      const curComment = await ModelComment.findOne({ uuid: commentUuid });

      if (user && curComment && foundArticle) {
        const { content } = requestData.body;
        const replyComment = new ModelComment({ content });
        replyComment.author = user._id;
        replyComment.article = foundArticle._id;
        const result = await replyComment.save();
        const savedReply = await ModelComment.findById(result._id)
          .select('-_id')
          .populate('author', '-_id -profile')
          .populate('article', '-_id -author');
        if (savedReply) {
          const responseComment = <IComment>savedReply.toObject();
          return {
            success: true,
            result: {
              ...responseComment,
            },
          };
        }
      }
    }

    throw new Error('We are not able to save comment');
  },
);

// Delete a comment
Mux.delete<IComment>(
  '/v1/comment/:commentUuid',
  CommentUuidValidator,
  async (requestData: IRequestData, req?: IMuxRequest): Promise<IResponseRecord<IComment>> => {
    const { commentUuid } = requestData.params;

    if (req && req.session) {
      const comment = await ModelComment.findOne({ uuid: commentUuid });
      const user = req.session.getUser();
      if (comment && user) {
        if (comment.author.toString() === user._id.toString()) {
          const deletedComment = await ModelComment.findByIdAndDelete(comment._id)
            .select('-_id')
            .populate('author', '-_id -profile')
            .populate('article', '-_id -author');
          if (deletedComment) {
            const responseComment = <IComment>deletedComment.toObject();
            return {
              success: true,
              result: {
                ...responseComment,
              },
            };
          }
        }
      }
    }

    throw new Error('We are not able to delete comment');
  },
);
