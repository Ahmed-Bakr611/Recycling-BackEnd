// utils/buildAggregationQuery.ts
interface AggregationOptions {
  filters?: Record<string, any>;
  lookups?: any[];
  addFields?: Record<string, any>;
  project?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  page?: number;
  limit?: number;
}

export async function runAggregation<T>(
  model: any,
  {
    filters = {},
    lookups = [],
    addFields = {},
    project,
    sort = { createdAt: -1 as -1 },
    page = 1,
    limit = 10,
  }: AggregationOptions
): Promise<{
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
}> {
  const skip = (page - 1) * limit;

  const pipeline: any[] = [];

  // Add lookups
  if (lookups.length) pipeline.push(...lookups);

  // Add fields
  if (Object.keys(addFields).length > 0) {
    pipeline.push({ $addFields: addFields });
  }

  // Filters
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }

  // Count pipeline
  const countPipeline = [...pipeline, { $count: "total" }];
  const totalResult = await model.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  // Add sort, project, pagination
  if (sort) pipeline.push({ $sort: sort });
  if (project) pipeline.push({ $project: project });
  pipeline.push({ $skip: skip }, { $limit: limit });

  const data = await model.aggregate(pipeline);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}
