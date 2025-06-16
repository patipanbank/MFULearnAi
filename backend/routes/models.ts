import { Router, Request, Response } from 'express';
import { ModelModel, ModelDocument } from '../models/Model';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../models/User';
import { TrainingHistory } from '../models/TrainingHistory';

const router = Router();

/**
 * GET /api/models
 * Retrieves all models (filtered based on user role)
 */
router.get('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    // console.log('User in models route:', user);
    
    // ดึงข้อมูลผู้ใช้
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
    const userDepartment = user.department;
    
    // Get all models
    const models = await ModelModel.find({}).lean();
    // console.log('Found models:', models);
    
    // กรองโมเดลตามเงื่อนไข:
    // 1. ทุก User เห็นเฉพาะ official และ personal ของตัวเอง
    // 2. User เห็น department models ที่ตรงกับ department ของตัวเอง
    const filteredModels = models.filter(model => {
      // Official models - ทุกคนมองเห็น
      if (model.modelType === 'official') {
        return true;
      }
      
      // Personal models - เฉพาะเจ้าของเท่านั้น
      if (model.modelType === 'personal' && model.createdBy === userId) {
        return true;
      }
      
      // Department models - เฉพาะคนในแผนกเดียวกัน
      if (model.modelType === 'department' && model.department === userDepartment) {
        return true;
      }
      
      return false;
    });

    res.json(filteredModels);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

/**
 * POST /api/models
 * Creates a new model
 */
router.post('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, modelType, department } = req.body;
    
    // Validate required fields
    if (!name || !modelType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user has Admin privileges from groups array
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    // Only Admin or SuperAdmin can create official or department models
    if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
      res.status(403).json({ message: 'Only Admin or SuperAdmin can create official or department models' });
      return;
    }

    // Department models require a department field
    if (modelType === 'department' && !department) {
      res.status(400).json({ error: 'Department is required for department models' });
      return;
    }

    // For admin users, use username as createdBy since they don't have nameID
    const createdBy = user.nameID || user.username;
    if (!createdBy) {
      res.status(400).json({ error: 'User identifier not found in token' });
      return;
    }

    // Create the model with empty collections array
    const model = await ModelModel.create({
      name,
      createdBy,
      modelType,
      department: modelType === 'department' ? department : undefined,
      collections: [], // Start with empty collections array
    });

    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Error creating model' });
  }
});

/**
 * PUT /api/models/:id/collections
 * Updates a model's collections
 */
router.put('/:id/collections', roleGuard(['Staffs', 'Admin', 'Students', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { collections } = req.body;
    const user = (req as any).user;

    // ตรวจสอบว่า model มีอยู่จริง
    const model = await ModelModel.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // ตรวจสอบสิทธิ์การแก้ไข
    const userGroups = user.groups || [];
    const isStaff = userGroups.includes('Staffs') || userGroups.includes('Admin') || userGroups.includes('Students') || userGroups.includes('SuperAdmin');
    const isOwner = model.createdBy === (user.nameID || user.username);

    if (!isStaff && !isOwner) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Generate descriptions for collections automatically
    const collectionsWithDescriptions = await Promise.all(
      collections.map(async (collectionName: string) => {
        try {
          // Generate description using LLM
          const description = await generateCollectionDescription(collectionName);
          return {
            name: collectionName,
            description: description
          };
        } catch (error) {
          console.error(`Error generating description for collection ${collectionName}:`, error);
          // Fallback to a simple description
          return {
            name: collectionName,
            description: `Knowledge base collection: ${collectionName}`
          };
        }
      })
    );

    // อัพเดท collections with descriptions
    const updatedModel = await ModelModel.findByIdAndUpdate(
      id,
      { collections: collectionsWithDescriptions },
      { new: true, runValidators: true }
    );

    if (!updatedModel) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // บันทึกประวัติการแก้ไข
    const userId = user.nameID || user.username;
    if (!userId) {
      throw new Error('User identifier not found');
    }

    // สร้าง TrainingHistory entries สำหรับแต่ละ collection
    await Promise.all(collections.map(async (collectionName: string) => {
      await TrainingHistory.create({
        userId: userId,
        username: user.username,
        collectionName: collectionName, // เพิ่ม collectionName
        documentName: model.name, // ใช้ชื่อ model เป็น documentName
        action: 'update_collection', // เปลี่ยนเป็น update_collection ตาม enum ที่กำหนด
        details: {
          modelId: id,
          modelName: model.name,
          collections: collections
        }
      });
    }));

    res.json(updatedModel);
  } catch (error) {
    console.error('Error updating model collections:', error);
    res.status(500).json({ error: 'Error updating model collections' });
  }
});

/**
 * POST /api/models/migrate-descriptions
 * Migrates existing models to add collection descriptions
 */
router.post('/migrate-descriptions', roleGuard(['Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Starting collection descriptions migration...');
    
    // Find all models that have collections without descriptions
    const models = await ModelModel.find({});
    let updatedCount = 0;
    let errorCount = 0;

    for (const model of models) {
      try {
        // Check if any collection lacks description or has empty description
        const needsUpdate = model.collections.some(collection => 
          !collection.description || 
          collection.description.trim() === '' ||
          typeof collection === 'string' // Old format
        );

        if (needsUpdate) {
          console.log(`Updating model: ${model.name} (${model._id})`);
          
          // Convert collections to new format with descriptions
          const collectionsWithDescriptions = await Promise.all(
            model.collections.map(async (collection: any) => {
              // Handle both old format (string) and new format (object)
              const collectionName = typeof collection === 'string' ? collection : collection.name;
              
              // Skip if already has a good description
              if (typeof collection === 'object' && collection.description && collection.description.trim() !== '') {
                return collection;
              }

              try {
                const description = await generateCollectionDescription(collectionName);
                return {
                  name: collectionName,
                  description: description
                };
              } catch (error) {
                console.error(`Error generating description for ${collectionName}:`, error);
                return {
                  name: collectionName,
                  description: `Knowledge base collection: ${collectionName}`
                };
              }
            })
          );

          // Update the model
          await ModelModel.findByIdAndUpdate(
            model._id,
            { collections: collectionsWithDescriptions },
            { new: true }
          );

          updatedCount++;
          console.log(`✅ Updated model: ${model.name}`);
          
          // Add small delay to avoid overwhelming the LLM service
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error updating model ${model.name}:`, error);
        errorCount++;
      }
    }

    console.log(`Migration completed. Updated: ${updatedCount}, Errors: ${errorCount}`);
    res.json({
      message: 'Collection descriptions migration completed',
      updated: updatedCount,
      errors: errorCount,
      total: models.length
    });
  } catch (error) {
    console.error('Error during migration:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

/**
 * Generates a description for a collection using LLM
 */
async function generateCollectionDescription(collectionName: string): Promise<string> {
  try {
    // Import BedrockService
    const { BedrockService } = await import('../services/bedrock.js');
    const bedrockService = new BedrockService();

    // Create a prompt to generate collection description
    const prompt = `You are an expert at analyzing knowledge base collections. Based on the collection name "${collectionName}", generate a concise, informative description that explains what kind of information this collection likely contains.

Guidelines:
1. Keep the description under 100 characters
2. Be specific and informative
3. Use professional language
4. Focus on the type of content/knowledge domain
5. Return only the description text, no additional formatting

Collection name: ${collectionName}

Description:`;

    // Call LLM to generate description
    const response = await bedrockService.invokeModelJSON(
      prompt,
      'anthropic.claude-3-haiku-20240307-v1:0'
    );

    // Extract description from response
    let description = '';
    if (typeof response === 'string') {
      description = response.trim();
    } else if (typeof response === 'object' && response.description) {
      description = response.description.trim();
    } else {
      description = String(response).trim();
    }

    // Fallback if description is too long or empty
    if (!description || description.length > 150) {
      description = `Knowledge collection containing information about ${collectionName.toLowerCase().replace(/[_-]/g, ' ')}`;
    }

    return description;
  } catch (error) {
    console.error('Error generating collection description:', error);
    // Fallback description
    return `Knowledge base collection: ${collectionName.replace(/[_-]/g, ' ')}`;
  }
}

/**
 * DELETE /api/models/:id
 * Deletes a model
 */
router.delete('/:id', roleGuard(['Staffs', 'Admin', 'Students', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const model = await ModelModel.findByIdAndDelete(id);

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Error deleting model' });
  }
});

/**
 * GET /api/models/:id
 * Gets a model's details
 */
router.get('/:id', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const model = await ModelModel.findById(id);

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Error fetching model' });
  }
});

export default router; 